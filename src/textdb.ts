import { InvalidArgumentError } from './errors';
import { DB_TABLE_SEP, TDB_FILE_EXT } from './constants';
import { promises as fs, constants as fsConstants } from 'fs';
import * as path from 'path';
import { createTableOptions, fieldProperty } from './types';
import { createTable } from './tables';

export class Textdb {
  protected workingDir = '';
  protected dbname = '';
  protected tables: Set<string> = new Set();
  protected databasePath: string;
  protected isReady: Promise<void>;
  /**
   * Instantiate a Textdb Object
   * @param databasePath {string} path to the database
   */
  constructor(databasePath: string) {
    if (!databasePath || databasePath.includes('../') || databasePath[0] === '/') {
      throw new InvalidArgumentError('Textdb::constructor failed: invalid path provided');
    }
    if (!databasePath.endsWith(TDB_FILE_EXT)) {
      databasePath += TDB_FILE_EXT;
    }
    this.databasePath = databasePath;
    this.isReady = this.initializeDb();
  }
  protected async initializeDb(): Promise<void> {
    try {
      fs.access(this.databasePath, fsConstants.F_OK | fsConstants.R_OK | fsConstants.W_OK);
    } catch {
      throw new Error('textdb: database does not exist, or is not readable and writable');
    }

    // Schema Improvement: the db file should contain a mapping of table names to file names.
    this.tables = new Set((await fs.readFile(this.databasePath, { encoding: 'utf-8' })).split(DB_TABLE_SEP));
    this.workingDir = path.dirname(this.databasePath);
    this.dbname = path.basename(this.databasePath.substr(0, this.databasePath.length - TDB_FILE_EXT.length));
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
  /**
   * Create a table
   *
   * @param tableName {string} the name of the table
   * @param fieldList {{name: string, type: string, length: number}[]} An array of fields and their properties
   * @param [options] {memoChunkLength: number} Specify options such as how large the internal memo chunk should be.
   */
  async createTable(
    tableName: string,
    fieldList: Array<fieldProperty>,
    options: createTableOptions = {},
  ): Promise<void> {
    await this.isReady;

    const internalTableName = this.getInternalTableName(tableName);
    if (this.tables.has(internalTableName)) {
      throw new InvalidArgumentError('createTable failed: table already exists');
    }

    try {
      await createTable(path.join(this.workingDir, internalTableName), fieldList, options);
    } catch (err) {
      throw err;
    }

    this.tables.add(internalTableName);
    this._writeTableNamesToDb();
  }

  protected async _writeTableNamesToDb(): Promise<void> {
    await fs.writeFile(this.databasePath, Array.from(this.tables).join(DB_TABLE_SEP));
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

  protected getInternalTableName(tableName: string): string {
    return `${this.dbname}_${tableName}`;
  }
}
