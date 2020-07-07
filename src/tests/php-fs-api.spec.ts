import * as os from 'os';
import { promises as fs } from 'fs';
import * as path from 'path';

import { fopen, SEEK } from '../php-fs-api';
import { F_OK, R_OK, O_CREAT, W_OK } from 'constants';
import { FILE_ENCODING } from '../constants';
import { OperationAlreadyInProgressError } from '../errors';

const generateId = () => Math.random().toString(36).substring(7);
const getTempFile = () => path.join(tempDir, generateId());
let tempDir: string;
beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-php-fs-api-'));
});

afterAll(async () => {
  const dir = await fs.readdir(tempDir);
  await Promise.all(dir.map((file) => fs.unlink(path.join(tempDir, file))));
  await fs.rmdir(tempDir);
});

describe('reading', () => {
  it('should read an existing file', async () => {
    const expected = 'hello world';
    const file = getTempFile();
    await fs.writeFile(file, expected);

    const f = await fopen(file, F_OK | R_OK);
    expect(await f.read(expected.length)).toBe(expected);
    await f.close();
  });

  it('should throw opening a non-existent file without the O_CREAT flag', async () => {
    expect.assertions(1);
    const file = getTempFile();
    try {
      const f = await fopen(file, R_OK);
      await f.close();
    } catch (err) {
      expect(err.code).toBe('ENOENT');
    }
  });

  it('should not be able to read a non-existent file with the O_CREAT flag', async () => {
    const expected = '';
    const file = getTempFile();

    const f = await fopen(file, O_CREAT | R_OK);
    expect(await f.read(100)).toBe(expected);
    await f.close();
  });
  it('should return a string across two buffers', async () => {
    const bufferSize = 100;
    const expected = 'hello world'.repeat(bufferSize);
    const file = getTempFile();
    await fs.writeFile(file, expected);

    const f = await fopen(file, R_OK, { bufferSize });
    expect(await f.read(expected.length)).toBe(expected);
    await f.close();
  });

  it('should not read past the end of file', async () => {
    const expected = 'hello world';
    const file = getTempFile();
    await fs.writeFile(file, expected);

    const f = await fopen(file, F_OK | R_OK);
    expect(await f.read(expected.length * 2)).toBe(expected);
    await f.close();
  });

  it('should throw if two reads happen at the same time', async () => {
    expect.assertions(2);
    const expected = 'hello world';
    const file = getTempFile();
    await fs.writeFile(file, expected);

    const f = await fopen(file, R_OK);
    try {
      await Promise.all([f.read(1), f.read(1)]);
    } catch (err) {
      expect(err).toBeInstanceOf(OperationAlreadyInProgressError);
      expect(err.message).toMatch(/read failed/);
    }
  });
});

describe('writing', () => {
  it('should overwrite parts of an existing file', async () => {
    const expected = 'hello world';
    const file = getTempFile();
    await fs.writeFile(file, expected);

    const f = await fopen(file, W_OK);
    await f.write('bye  ');
    await f.close();
    expect(await fs.readFile(file, FILE_ENCODING)).toBe('bye   world');
  });

  it('should write a string across two buffers', async () => {
    const bufferSize = 100;
    const expected = 'hello world'.repeat(bufferSize);
    const file = getTempFile();

    const f = await fopen(file, O_CREAT | W_OK, { bufferSize });
    await f.write(expected);
    await f.close();

    expect(await fs.readFile(file, FILE_ENCODING)).toBe(expected);
  });

  it('should read from the buffer after a write', async () => {
    const expected = 'hello world';
    const file = getTempFile();
    await fs.writeFile(file, expected);

    const f = await fopen(file, R_OK | W_OK);
    expect(await f.read(1)).toBe(expected[0]);
    await f.write('f');
    const actual1 = await f.read(1);
    await f.seek(0);
    const actual2 = await f.read(3);
    await f.close();
    expect(await fs.readFile(file, FILE_ENCODING)).toBe('hfllo world');
    expect(actual1).toBe(expected[2]);
    expect(actual2).toBe('hfl');
  });
  it('writing outside the first buffer succeeds', async () => {
    const bufferSize = 10;
    const str = '1234567890';
    const file = getTempFile();
    await fs.writeFile(file, str.repeat(bufferSize));

    const mid = str.length / 2;
    const end = str.length;

    const f = await fopen(file, R_OK | W_OK, { bufferSize });
    expect(await f.read(mid)).toBe(str.substring(0, mid));
    await f.write(str);
    await f.seek(-mid, SEEK.CUR);
    expect(await f.read(mid)).toBe(str.substring(mid, end));

    await f.seek(0);
    expect(await f.read(end)).toBe(str.substring(0, mid).repeat(2));

    await f.close();
    const expected = str.substring(0, mid) + str + str.substring(mid, end) + str.repeat(bufferSize - 2);
    expect(await fs.readFile(file, FILE_ENCODING)).toBe(expected);
  });

  it('seeking past EOF will write it past EOF not _at_ EOF', async () => {
    const expected = 'hello world';
    const file = getTempFile();

    const skipLen = 10;
    const f = await fopen(file, O_CREAT | W_OK);
    await f.seek(skipLen);
    await f.write(expected);
    await f.close();

    const actual = await fs.readFile(file, FILE_ENCODING);
    // expect(actual.length).toBe(expected.length);
    expect(actual).toBe('\0'.repeat(skipLen) + expected);
  });

  it('should throw if two writes happen at the same time', async () => {
    expect.assertions(2);
    const expected = 'hello world';
    const file = getTempFile();
    await fs.writeFile(file, expected);

    const f = await fopen(file, R_OK);
    try {
      await Promise.all([f.write('foo'), f.write('bar')]);
    } catch (err) {
      expect(err).toBeInstanceOf(OperationAlreadyInProgressError);
      expect(err.message).toMatch(/write failed/);
    }
  });
});

describe('tell', () => {
  it('should return 0 at the beginning of the file', async () => {
    const data = 'hello world';
    const file = getTempFile();
    await fs.writeFile(file, data);

    const f = await fopen(file, F_OK | R_OK);
    expect(f.tell()).toBe(0);
    await f.close();
  });
  it('should return 1 after reading one character', async () => {
    const data = 'hello world';
    const file = getTempFile();
    await fs.writeFile(file, data);

    const f = await fopen(file, F_OK | R_OK);
    const expected = 1;
    await f.read(expected);
    expect(f.tell()).toBe(expected);
    await f.close();
  });
});

describe('getc()', () => {
  it('should return one character at a time, until the end of file', async () => {
    const data = 'hello world';
    expect.assertions(data.length + 1);
    const file = getTempFile();
    await fs.writeFile(file, data);

    const f = await fopen(file, R_OK);
    for (const expected of data) {
      expect(await f.read(1)).toBe(expected);
    }
    // now it's EOF, so nothing should be read.
    expect(await f.read(1)).toBe('');
    await f.close();
  });
});

describe('eof()', () => {
  it('should return true for a new file', async () => {
    const file = getTempFile();

    const f = await fopen(file, O_CREAT | W_OK | R_OK);
    expect(await f.eof()).toBe(true);
    await f.close();
  });
  it('should return true for a zero length file', async () => {
    const file = getTempFile();
    await fs.writeFile(file, '');

    const f = await fopen(file, F_OK);
    expect(await f.eof()).toBe(true);
    await f.close();
  });
  it('should return false for a non-zero length file', async () => {
    const file = getTempFile();
    await fs.writeFile(file, '1');

    const f = await fopen(file, F_OK);
    expect(await f.eof()).toBe(false);
    await f.close();
  });
  it('should return true after seeking to the end of file', async () => {
    const file = getTempFile();
    await fs.writeFile(file, '1');

    const f = await fopen(file, F_OK);
    await f.seek(1);
    expect(await f.eof()).toBe(true);
    await f.close();
  });

  it('should return true after reading to the end of the file', async () => {
    const file = getTempFile();
    await fs.writeFile(file, '1');

    const f = await fopen(file, R_OK);
    await f.read(1);
    expect(await f.size()).toBe(1);
    expect(await f.eof()).toBe(true);
    await f.close();
  });
  it('should return true after writing to the end of the file', async () => {
    const file = getTempFile();
    await fs.writeFile(file, '1');

    const f = await fopen(file, W_OK);
    await f.write('f');
    expect(await f.eof()).toBe(true);
    await f.close();
  });
  it('should return true when appending data to the end of the file', async () => {
    const file = getTempFile();
    await fs.writeFile(file, '1');

    const f = await fopen(file, W_OK);
    await f.write('ff');
    expect(await f.eof()).toBe(true);
    await f.close();
  });
  it('should return false, when appending data to the end, and then seeking past the original eof marker', async () => {
    const file = getTempFile();
    await fs.writeFile(file, '1');

    const f = await fopen(file, W_OK);
    await f.write('fffffff');
    await f.seek(-3);
    expect(await f.eof()).toBe(false);
    await f.close();
  });
});
