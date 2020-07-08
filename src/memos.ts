import { fopen, ExtendedFile } from './php-fs-api-extended';
import { F_OK, R_OK, W_OK } from 'constants';
import { SEEK } from './php-fs-api';
import { REF_LENGTH, FILE_ENCODING, MEMO_END_OF_CONTENT, NULL_REF } from './constants';
import { InvalidArgumentError } from './errors';
import { promises as fs } from 'fs';
import { getRefFromPosition, getPositionFromRef, serializeRef } from './utils';
import { SerialRunner } from './serial-runner';
import Debug, { Debugger } from 'debug';
import path from 'path';

const debug = Debug('memo');

export async function createNewMemoFile(memoFile: string, memoChunkSize: number): Promise<void> {
  if (memoChunkSize < REF_LENGTH + 1 || !Number.isInteger(memoChunkSize)) {
    throw new InvalidArgumentError('createNewMemoFile failed: length must be one greater than REF_LENGTH');
  }
  await fs.writeFile(memoFile, serializeRef(NULL_REF, memoChunkSize), FILE_ENCODING);
}

export async function openMemo(memoFile: string, memoChunkSize: number): Promise<Memo> {
  const fh = await fopen(memoFile, F_OK | R_OK | W_OK, { bufferSize: memoChunkSize });
  const hUnallocChunkAddr = await fh.readRef();
  return new Memo(fh, hUnallocChunkAddr, memoChunkSize, debug.extend(path.basename(memoFile)));
}

export class Memo extends SerialRunner {
  readonly fh: ExtendedFile;
  protected readonly chunkSize: number;
  protected hUnallocChunkAddr: number;
  protected debug: Debug.Debugger;

  constructor(fh: ExtendedFile, hUnallocChunkAddr: number, chunkSize: number, debug: Debugger) {
    super();
    this.fh = fh;
    this.chunkSize = chunkSize;
    this.hUnallocChunkAddr = hUnallocChunkAddr;
    this.debug = debug;
  }

  async close(): Promise<void> {
    return this.runNext(() => this.fh.close());
  }

  getUnallocChunkAddr(): number {
    return this.hUnallocChunkAddr;
  }

  protected async allocAndSeek(): Promise<number> {
    // $next = first addr
    // if $next === NULL_REF, seek to EOF addr;
    // else
    // return seek to $next; read $next; reset to addr;

    if (this.hUnallocChunkAddr === NULL_REF) {
      await this.fh.seek(0, SEEK.END);
      return getRefFromPosition(this.fh.tell(), this.chunkSize);
    } else {
      await this.fh.seek(this.hUnallocChunkAddr * this.chunkSize, SEEK.SET);
      const curr = this.hUnallocChunkAddr;
      this.hUnallocChunkAddr = await this.fh.readRef();
      await this.fh.seek(0);
      await this.fh.writeRef(this.hUnallocChunkAddr);
      await this.fh.seek(getPositionFromRef(curr, this.chunkSize));
      return curr;
    }
  }

  async write(data: string): Promise<number> {
    return this.runNext(() => this._write(data));
  }

  protected async _write(data: string): Promise<number> {
    let returnAddr = NULL_REF;
    const dataChunkLength = this.chunkSize - REF_LENGTH - 1;
    while (data.length > 0) {
      const currAddr = await this.allocAndSeek();
      if (returnAddr === NULL_REF) {
        returnAddr = currAddr;
      }

      // if data.length < chunkLength -> only need this block ref=NULL_REF
      // else if EOF===true, ref=curr+1
      // else if lastUnallocChunk === NULL_REF, ref=EOF ref
      // else if lastUnallocChunk !== NULL_REF, ref=already pointing ot next unalloc block
      let chunkLengthToWrite = this.chunkSize;
      let chunk: string;
      if (data.length <= dataChunkLength) {
        chunk = serializeRef(NULL_REF);
      } else if (await this.fh.eof()) {
        chunk = serializeRef(currAddr + 1);
      } else if (this.hUnallocChunkAddr === NULL_REF) {
        const next = getRefFromPosition(await this.fh.getEofPosition(), this.chunkSize);
        chunk = serializeRef(next);
      } else {
        // ref is already correct, don't write anything
        chunk = '';
        chunkLengthToWrite -= REF_LENGTH;
        await this.fh.seek(REF_LENGTH);
      }

      // write data chunk and and move on
      chunk += data.substring(0, dataChunkLength) + MEMO_END_OF_CONTENT;
      data = data.substring(dataChunkLength);
      this.debug('write[%d]: %s', currAddr, chunk);
      await this.fh.write(chunk.padEnd(chunkLengthToWrite));
    }
    return returnAddr;
  }

  async read(addr: number): Promise<string> {
    return this.runNext(() => this._read(addr));
  }

  protected async _read(addr: number): Promise<string> {
    let data = '';
    let next = addr;

    if (addr < 1 || !Number.isInteger(addr)) {
      throw new InvalidArgumentError('readMemo failed: addr needs to be a positive integer');
    }

    while (next && next > 0) {
      await this.fh.seek(getPositionFromRef(next, this.chunkSize));
      next = await this.fh.readRef();
      const [substring] = (await this.fh.read(this.chunkSize - REF_LENGTH)).split(MEMO_END_OF_CONTENT);
      data += substring;
      this.debug('read[%d] -> %s', next, substring);
    }
    return data;
  }

  async delete(addr: number): Promise<void> {
    return this.runNext(() => this._delete(addr));
  }

  protected async _delete(addr: number): Promise<void> {
    // as-is:
    // b1 -> b2 -> b3 -> null
    // d1 -> d2 -> null

    // to-be state:
    // b1 -> b2 -> b3 -> d1 -> d2 -> null

    if (addr < 1 || !Number.isInteger(addr)) {
      throw new InvalidArgumentError('deleteMemo failed: addr needs to be a positive integer');
    }

    if (getPositionFromRef(addr, this.chunkSize) >= (await this.fh.size())) {
      return; // if we've fallen off the edge, don't do anything
    }

    let next = addr;
    await this.fh.seek(REF_LENGTH); // if we don't enter the loop, we need to be able to write to position 0
    while (next !== NULL_REF) {
      this.debug('delete[%d]', next);
      await this.fh.seek(getPositionFromRef(next, this.chunkSize));
      next = await this.fh.readRef();
    }
    await this.fh.seek(-REF_LENGTH, SEEK.CUR);
    await this.fh.writeRef(this.hUnallocChunkAddr ?? NULL_REF);
    this.hUnallocChunkAddr = addr;
    await this.fh.seek(0);
    await this.fh.writeRef(this.hUnallocChunkAddr);
  }
}
