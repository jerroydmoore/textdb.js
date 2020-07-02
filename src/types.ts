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
