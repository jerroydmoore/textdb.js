import { InvalidArgumentError } from './errors';
import { TDB_FILE_EXT } from './constants';
import { promises as fs, constants as fsConstants } from 'fs';
import * as path from 'path';

export class Textdb {
  constructor() {
    //
  }

  /**
   * Creates a database. Run new Textdb(dir, filename) before handling the database
   *
   * @async
   * @static
   * @param databasePath {string} path to the database
   * @throws if the databasePath is invalid, includes '../', or begins with '/
   * @throws if the database already exists
   * @throws if the directory doesn't exist, or is not writable and readable
   */
  static async createDatabase(databasePath: string): Promise<void> {
    if (!databasePath || databasePath.includes('../') || databasePath[0] === '/') {
      throw new InvalidArgumentError('createDatabase failed: invalid path provided');
    }

    if (!databasePath.endsWith(TDB_FILE_EXT)) {
      databasePath += TDB_FILE_EXT;
    }

    try {
      await fs.access(databasePath, fsConstants.F_OK);
      throw new InvalidArgumentError('createDatabase failed: database already exists');
    } catch {
      // ignore file does not exist error
    }
    const dir = path.dirname(databasePath);
    try {
      await fs.access(dir, fsConstants.F_OK | fsConstants.R_OK | fsConstants.W_OK);
    } catch {
      throw new InvalidArgumentError('createDatabase failed: directory does not exist or is not writable and readable');
    }

    await fs.writeFile(databasePath, '');
  }

  static removeDatabase() {
    //
  }
  createTable() {
    //
  }
  removeTable() {
    //
  }
  getTableList() {
    //
  }
  isTable() {
    //
  }
  getTable() {
    //
  }
  version() {
    //
  }
}
