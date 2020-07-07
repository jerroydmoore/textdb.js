import * as os from 'os';
import { promises as fs } from 'fs';
import * as path from 'path';
import { R_OK } from 'constants';

import { fopen } from '../php-fs-api-extended';
import { UnexpectedEndOfFileError } from '../errors';

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

describe('getStringUntil', () => {
  it('should read a string until a terminating character', async () => {
    const data = 'hello world';
    const file = getTempFile();
    await fs.writeFile(file, data);

    const f = await fopen(file, R_OK);
    expect(await f.getStringUntil(' ')).toBe('hello');
    await f.close();
  });
  it('should set position after the terminating character after a read', async () => {
    const data = 'hello world';
    const file = getTempFile();
    await fs.writeFile(file, data);

    const f = await fopen(file, R_OK);
    await f.getStringUntil(' ');
    expect(await f.read(1)).toBe('w');
    await f.close();
  });
  it('should throw if it cannot find the terminating character', async () => {
    expect.assertions(1);
    const data = 'hello world';
    const file = getTempFile();
    await fs.writeFile(file, data);

    const f = await fopen(file, R_OK);
    try {
      await f.getStringUntil('z');
    } catch (err) {
      expect(err).toBeInstanceOf(UnexpectedEndOfFileError);
    }
    await f.close();
  });
});
