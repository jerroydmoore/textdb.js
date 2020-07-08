import { promises as fs } from 'fs';
import { File, FileOptions } from './php-fs-api';
import { UnexpectedEndOfFileError } from './errors';
import { deserializeRef, serializeRef } from './utils';
import { REF_LENGTH } from './constants';

export async function fopen(filename: string, mode: string | number, options: FileOptions = {}): Promise<ExtendedFile> {
  const fileHandle = await fs.open(filename, mode);
  const { blksize } = await fileHandle.stat();
  options.bufferSize = options.bufferSize ?? blksize;
  return new ExtendedFile(fileHandle, options);
}

export class ExtendedFile extends File {
  constructor(fh: fs.FileHandle, options?: FileOptions) {
    super(fh, options);
  }
  async getStringUntil(terminatingChar: string): Promise<string> {
    let substring = '';
    while (true) {
      const char = await this.getc();
      if (char === '') {
        throw new UnexpectedEndOfFileError('getStringUntil failed: encountered end of file unexpectedly.');
      } else if (char === terminatingChar) {
        return substring;
      }
      substring += char;
    }
  }

  async getEofPosition(): Promise<number> {
    return await this.size();
  }
  async readRef(length?: number): Promise<number> {
    return deserializeRef(await this.read(length ?? REF_LENGTH));
  }
  async writeRef(ref: number, length = REF_LENGTH): Promise<void> {
    await this.write(serializeRef(ref, length));
  }
}
