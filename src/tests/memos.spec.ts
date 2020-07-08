import * as os from 'os';
import { promises as fs } from 'fs';
import * as path from 'path';

import { createNewMemoFile, openMemo } from '../memos';
import { REF_LENGTH, NULL_REF, MEMO_FILE_EXT, FILE_ENCODING, MEMO_END_OF_CONTENT } from '../constants';
import { InvalidArgumentError } from '../errors';
import { serializeRef } from '../utils';

const generateId = () => Math.random().toString(36).substring(7);
const getTempFile = () => path.join(tempDir, generateId() + MEMO_FILE_EXT);
let tempDir: string;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-memo-'));
});

afterAll(async () => {
  const dir = await fs.readdir(tempDir);
  await Promise.all(dir.map((file) => fs.unlink(path.join(tempDir, file))));
  await fs.rmdir(tempDir);
});

const chunkSize = 10 + REF_LENGTH + 1;

describe('createNewMemoFile', () => {
  it('should throw if memoChunkSize is not an integer', async () => {
    expect.assertions(1);
    try {
      await createNewMemoFile(getTempFile(), 10.1);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidArgumentError);
    }
  });

  it('should throw if memoChunkSize is too low', async () => {
    expect.assertions(1);
    try {
      await createNewMemoFile(getTempFile(), REF_LENGTH);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidArgumentError);
    }
  });
  it('should create a memo file', async () => {
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    expect(await fs.readFile(tempFile, FILE_ENCODING)).toBe('-1                ');
  });
});

describe('getUnallocChunkAddr()', () => {
  it('should be the null ref for new files', async () => {
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);

    expect(memo.getUnallocChunkAddr()).toBe(NULL_REF);
    await memo.close();
  });
});

describe('write()', () => {
  it('should append a chunk to the file when writing the first memo', async () => {
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);
    // data within one chunk
    const data = 'foo';
    expect(await memo.write(data)).toBe(1);

    await memo.close();
    let expected = serializeRef(NULL_REF);
    expected = expected.padEnd(chunkSize, ' ') + (expected + data + MEMO_END_OF_CONTENT).padEnd(chunkSize, ' ');
    expect(await fs.readFile(tempFile, FILE_ENCODING)).toBe(expected);
  });

  it('should append multiple chunks to the file when writing the first memo', async () => {
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);
    // data within one chunk
    const data = 'foo'.repeat(chunkSize);
    expect(await memo.write(data)).toBe(1);

    await memo.close();

    const expected =
      '-1                ' +
      ('2      foofoofoof' + MEMO_END_OF_CONTENT) +
      ('3      oofoofoofo' + MEMO_END_OF_CONTENT) +
      ('4      ofoofoofoo' + MEMO_END_OF_CONTENT) +
      ('5      foofoofoof' + MEMO_END_OF_CONTENT) +
      ('6      oofoofoofo' + MEMO_END_OF_CONTENT) +
      ('-1     ofoo' + MEMO_END_OF_CONTENT + '      ');

    expect(await fs.readFile(tempFile, FILE_ENCODING)).toBe(expected);
  });
});
describe('read()', () => {
  it('should throw for non-positive addresses', async () => {
    expect.assertions(2);
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);

    try {
      await memo.read(0);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidArgumentError);
    }
    try {
      await memo.read(-1);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidArgumentError);
    }
    await memo.close();
  });
  it('should throw for non-integer addresses', async () => {
    expect.assertions(1);
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);

    try {
      await memo.read(10.1);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidArgumentError);
    }
    await memo.close();
  });
  it('should read one chunk of data that was written', async () => {
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);
    const data = 'foo';
    const addr = await memo.write(data);

    expect(await memo.read(addr)).toBe(data);

    await memo.close();
  });
  it('should read multiple chunks of data that was written', async () => {
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);
    // data within one chunk
    const expected = 'foo'.repeat(chunkSize);
    const addr = await memo.write(expected);

    expect(await memo.read(addr)).toBe(expected);
    await memo.close();
  });

  it('should return the empty string trying to read past EOF', async () => {
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);
    expect(await memo.read(2)).toBe('');
  });
});

describe('delete()', () => {
  it('should throw if the given address is not an integer', async () => {
    expect.assertions(1);
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);
    try {
      await memo.delete(10.4);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidArgumentError);
    }
  });

  it('should throw if the given address is non-positive', async () => {
    expect.assertions(1);
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);
    try {
      await memo.delete(-1);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidArgumentError);
    }
  });

  it('should delete one chunk properly', async () => {
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);

    const actual = await memo.write('foo');
    await memo.delete(actual);
    expect(actual).toBe(memo.getUnallocChunkAddr());
  });

  it('should delete multiple chunk properly', async () => {
    const dataChunkSize = chunkSize - REF_LENGTH - 1;
    const data = 'foo'.repeat(2 * dataChunkSize);
    expect.assertions(2 * (data.length / dataChunkSize));

    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);

    const addr = await memo.write(data);
    await memo.delete(addr);

    for (let i = 0; i < data.length / dataChunkSize; i++) {
      expect(memo.getUnallocChunkAddr()).toBe(addr + i);
      expect(await memo.write('foo')).toBe(addr + i);
    }
  });

  it('should do nothing when trying to delete past EOF', async () => {
    const tempFile = getTempFile();
    await createNewMemoFile(tempFile, chunkSize);
    const memo = await openMemo(tempFile, chunkSize);
    await memo.delete(2);
    expect(memo.getUnallocChunkAddr()).toBe(NULL_REF);
  });
});
