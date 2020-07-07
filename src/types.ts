export type createTableOptions = {
  memoChunkLength?: number;
};

export enum fieldType {
  string = 'string',
  number = 'number',
  id = 'id',
  memo = 'memo',
}

export type fieldProperty = {
  name: string;
  type: fieldType;
  length?: number;
};

export type tableHeader = {
  hFieldHeaderLength: number;
  hFields: Array<fieldProperty>;
  hRecordLength: number;
  hCurrentId: number;
  hCurrentIdPosition: number;
  hUnallocRecordAddr: number;
  hUnallocRecordAddrPosition: number;
  hMemoChunkSize: number;
  hRecordPosition: number;
};
