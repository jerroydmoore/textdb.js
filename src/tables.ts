import { constants as fsConstants, promises as fs } from 'fs';
import { createTableOptions, fieldProperty, fieldType, tableHeader } from './types';
import {
  FIELD_SEP,
  FIELD_PROP_SEP,
  FILE_ENCODING,
  HEAD_ATTR_SEP,
  MEMO_FILE_EXT,
  REF_FILE_EXT,
  REF_LENGTH,
  TABLE_FILE_EXT,
  BUFFER_SIZE,
} from './constants';
import { InvalidArgumentError } from './errors';
import { fopen } from './php-fs-api-extended';

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

export async function removeTableFiles(tablePathPrefix: string): Promise<void> {
  await Promise.all([
    fs.unlink(tablePathPrefix + TABLE_FILE_EXT),
    fs.unlink(tablePathPrefix + MEMO_FILE_EXT),
    fs.unlink(tablePathPrefix + REF_FILE_EXT),
  ]);
}

export async function openTable(tablePathPrefix: string): Promise<TextdbTable> {
  const tableFile = tablePathPrefix + TABLE_FILE_EXT;
  const memoFile = tablePathPrefix + MEMO_FILE_EXT;
  const refFile = tablePathPrefix + REF_FILE_EXT;
  try {
    await Promise.all([
      fs.access(tableFile, fsConstants.F_OK | fsConstants.R_OK | fsConstants.W_OK),
      fs.access(memoFile, fsConstants.F_OK | fsConstants.R_OK | fsConstants.W_OK),
      fs.access(refFile, fsConstants.F_OK | fsConstants.R_OK | fsConstants.W_OK),
    ]);
  } catch {
    throw new Error('failed table operation: table files do not exist or are not writable and readable');
  }
  const header = await readTableHeader(tableFile);
  return new TextdbTable(tableFile, memoFile, refFile, header);
}

export async function readTableHeader(tableFile: string): Promise<tableHeader> {
  const fh = await fopen(tableFile, fsConstants.O_RDONLY, { bufferSize: BUFFER_SIZE });

  let rawValue: string;

  rawValue = await fh.getStringUntil(HEAD_ATTR_SEP);
  const hFieldHeaderLength = parseInt(rawValue, 10);

  rawValue = await fh.read(hFieldHeaderLength);
  const hFields = rawValue
    .split(FIELD_SEP)
    .map((x) => x.split(FIELD_PROP_SEP))
    .map(([, type, length, name]) => ({
      name,
      type: <fieldType>type,
      length: parseInt(length, 10),
    }));

  rawValue = await fh.getStringUntil(HEAD_ATTR_SEP);
  const hRecordLength = parseInt(rawValue, 10);

  const hCurrentIdPosition = fh.tell();
  rawValue = await fh.getStringUntil(HEAD_ATTR_SEP);
  const hCurrentId = parseInt(rawValue, 10);

  const hUnallocRecordAddrPosition = fh.tell();
  rawValue = await fh.getStringUntil(HEAD_ATTR_SEP);
  const hUnallocRecordAddr = parseInt(rawValue, 10);

  rawValue = await fh.getStringUntil(HEAD_ATTR_SEP);
  const hMemoChunkSize = parseInt(rawValue, 10);

  const hRecordPosition = fh.tell();
  await fh.close();
  return {
    hFieldHeaderLength,
    hFields,
    hRecordLength,
    hCurrentId,
    hCurrentIdPosition,
    hUnallocRecordAddr,
    hUnallocRecordAddrPosition,
    hMemoChunkSize,
    hRecordPosition,
  };
}

export class TextdbTable {
  protected tableFile: string;
  protected memoFile: string;
  protected refFile: string;
  protected header: tableHeader;

  constructor(tableFile: string, memoFile: string, refFile: string, header: tableHeader) {
    this.tableFile = tableFile;
    this.memoFile = memoFile;
    this.refFile = refFile;
    this.header = header;
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
