import { promises as fs } from 'fs';
import { OperationAlreadyInProgressError } from './errors';
import { getCallee } from './utils';

export const DEFAULT_BUFFER_SIZE = 4096;
export const DEFAULT_ENCODING: BufferEncoding = 'utf8';

export type FileOptions = { bufferSize?: number; encoding?: BufferEncoding };

export async function fopen(filename: string, mode: string | number, options: FileOptions = {}): Promise<File> {
  const fileHandle = await fs.open(filename, mode);

  const { blksize } = await fileHandle.stat();
  options.bufferSize = options.bufferSize ?? blksize ?? DEFAULT_BUFFER_SIZE;

  return new File(fileHandle, options);
}

export enum SEEK {
  SET,
  CUR,
  END,
}

export class File {
  fh: fs.FileHandle;
  protected buffer: Buffer;
  protected filePosition = 0; // points to beginning of buffer data
  protected bufferPosition = 0;
  protected bufferLength = 0;
  protected encoding: BufferEncoding;
  private lock = false;

  constructor(fh: fs.FileHandle, options?: FileOptions) {
    this.fh = fh;
    this.buffer = Buffer.alloc(options?.bufferSize || DEFAULT_BUFFER_SIZE);
    this.encoding = options?.encoding || DEFAULT_ENCODING;
  }

  protected acquireLock(): void {
    if (this.lock) {
      throw new OperationAlreadyInProgressError(`${getCallee()} failed: another operation is already in progress`);
    }
    this.lock = true;
  }
  protected releaseLock(): void {
    this.lock = false;
  }

  protected async hydrateBuffer(readSize = -1): Promise<boolean> {
    if (readSize === -1) {
      readSize = this.buffer.length;
    }
    if (this.bufferPosition < this.bufferLength) {
      return true;
    } else if (await this.eof()) {
      return false;
    } else {
      // case 1: newly created, bufferLength=0;
      // case 2: buffer has data, seeking to next block
      // case 3: at EOF, filePosition will remain unchanged.
      this.filePosition += this.bufferLength;
      const { bytesRead } = await this.fh.read(this.buffer, 0, readSize, this.filePosition);

      this.bufferLength = bytesRead;
      this.bufferPosition = 0;
      return bytesRead > 0;
    }
  }

  async seek(offset: number, whence: SEEK = SEEK.SET): Promise<void> {
    this.acquireLock();
    // filePos - buffLen <= buffer < filePos
    // do we reset buffers?
    // if newPos < curPos && newPos >= curPos - bufLen, no, and update bufferPosition
    // otherwise, yes

    try {
      let newPosition: number;
      if (whence === SEEK.CUR) {
        newPosition = this.tell() + offset;
      } else if (whence === SEEK.SET) {
        newPosition = offset;
      } else {
        //SEEK.END
        newPosition = (await this.size()) + offset;
      }

      if (newPosition >= this.filePosition && newPosition < this.filePosition + this.bufferLength) {
        // still inside buffer range, update bufferPosition only.
        this.bufferPosition = newPosition - this.filePosition;
      } else {
        // seek outside the buffer range, reset buffer
        this.filePosition = newPosition;
        this.bufferPosition = 0;
        this.bufferLength = 0;
      }
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Tests for end-of-file
   */
  async eof(): Promise<boolean> {
    return this.tell() >= (await this.size());
  }

  async size(): Promise<number> {
    return (await this.fh.stat()).size;
  }

  /**
   * Gets the next character in the file
   */
  async getc(): Promise<string> {
    return await this.read(1);
  }

  /**
   * Reads up to length bytes. Reading stops as soon as one of the following conditions is met:
   * * length bytes have been read
   * * EOF (end of file) is reached
   * @param length {number} up to length number of bytes to read
   */
  async read(length: number): Promise<string> {
    this.acquireLock();
    // either string is completely in memory,
    // or half in memory, half in one or more buffers.

    try {
      let substring = '';
      while (length > 0) {
        if (!(await this.hydrateBuffer())) {
          // eof
          break;
        }

        const bufferReadLength = Math.min(length, this.bufferLength - this.bufferPosition);

        substring += this.buffer.toString(this.encoding, this.bufferPosition, this.bufferPosition + bufferReadLength);
        this.bufferPosition += bufferReadLength;
        length -= bufferReadLength;
      }
      return substring;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * writes the contents of data at the current position
   * @param data {string} the string to be written
   * @returns {number} how many bytes written
   */
  async write(data: string): Promise<number> {
    this.acquireLock();
    try {
      const { bytesWritten } = await this.fh.write(data, this.filePosition + this.bufferPosition, this.encoding);
      // update the buffer and bufferPosition
      this.buffer.write(data, this.bufferPosition, this.encoding);
      this.bufferPosition += data.length; // we could fall off of the buffer, but read will re-hydrate buffer, and we might still want this buffer if we decide to seek rewind.
      return bytesWritten;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Returns the position of the file pointer
   */
  tell(): number {
    return this.filePosition + this.bufferPosition;
  }

  /**
   * Closes the file pointer
   */
  close(): Promise<void> {
    this.acquireLock();
    try {
      return this.fh.close();
    } finally {
      this.releaseLock();
    }
  }
}
