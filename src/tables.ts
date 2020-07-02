import { constants as fsConstants, promises as fs } from 'fs';
import { createTableOptions, fieldProperty, fieldType } from './types';
import {
  FIELD_SEP,
  FIELD_PROP_SEP,
  FILE_ENCODING,
  HEAD_ATTR_SEP,
  MEMO_FILE_EXT,
  REF_FILE_EXT,
  REF_LENGTH,
  TABLE_FILE_EXT,
} from './constants';
import { InvalidArgumentError } from './errors';

/**
 * Create a table
 * @param tablePathPrefix {string} The path to the table, sans file extensions
 * @param fieldList {{name: string, type: string, length: number}[]} An array of fields and their properties
 * @param [options] {memoChunkLength: number} Specify options such as how large the internal memo chunk should be.
 * @throws if the fieldList is not an array or includes an invalid type
 * @throws if the table file already exists.
 */
export async function createTable(
  tablePathPrefix: string,
  fieldList: Array<fieldProperty>,
  options: createTableOptions = {},
): Promise<void> {
  if (!Array.isArray(fieldList)) {
    throw new InvalidArgumentError('createTable: fieldList must be an array');
  }
  const tablePath = tablePathPrefix + TABLE_FILE_EXT;
  try {
    await fs.access(tablePath, fsConstants.F_OK);
    throw new InvalidArgumentError('createTable failed: table file already exists');
  } catch {
    // ignore file does not exist error
  }

  let hFields = '';
  let hRecordLength = 0;

  for (let i = 0; i < fieldList.length; i++) {
    const field = fieldList[i];
    if (!Object.values(fieldType).includes(field.type)) {
      throw new InvalidArgumentError('createTable failed: invalid field type in fieldList');
    }
    if (field.type === fieldType.id || field.type === fieldType.memo) {
      field.length = REF_LENGTH; // ids and memos are always 7 chars long
    }
    if (field.length == null || !Number.isInteger(field.length) || field.length < 1) {
      throw new InvalidArgumentError('createTable failed: length expects a number');
    }
    if (hFields.length > 0) {
      hFields += FIELD_SEP;
    }
    hFields += `${i + 1}${FIELD_PROP_SEP + field.type + FIELD_PROP_SEP + field.length + FIELD_PROP_SEP + field.name}`;
    hRecordLength += field.length;
  }

  const hCurrentId = '0'.padEnd(REF_LENGTH, ' ');
  const hUnusedMemoId = '-1'.padEnd(REF_LENGTH, ' ');
  const hMemoChunkLength = (options?.memoChunkLength || 100) + REF_LENGTH + 1;
  const header =
    hFields.length +
    HEAD_ATTR_SEP +
    hFields +
    hRecordLength +
    HEAD_ATTR_SEP +
    hCurrentId +
    HEAD_ATTR_SEP +
    hUnusedMemoId +
    HEAD_ATTR_SEP +
    hMemoChunkLength +
    HEAD_ATTR_SEP;

  const memoBlockZero = '-1'.padEnd(hMemoChunkLength, ' ');

  await Promise.all([
    fs.writeFile(tablePath, header, FILE_ENCODING),
    fs.writeFile(tablePathPrefix + MEMO_FILE_EXT, memoBlockZero, FILE_ENCODING),
    fs.writeFile(tablePathPrefix + REF_FILE_EXT, '', FILE_ENCODING),
  ]);
}

export class TextdbTables {
  constructor() {
    //
  }
  addField(): void {
    //
  }
  editField(): void {
    //
  }
  removeField(): void {
    //
  }
  reBuild(): void {
    //
  }
  sortAndBuild(): void {
    //
  }
  getRecords(): void {
    //
  }
  getOneRecord(): void {
    //
  }
  basicQuery(): void {
    //
  }
  query(): void {
    //
  }
  getNumberOfRecords(): void {
    //
  }
  getFieldList(): void {
    //
  }
  insertRecord(): void {
    //
  }
  removeRecord(): void {
    //
  }
  editRecord(): void {
    //
  }
}
