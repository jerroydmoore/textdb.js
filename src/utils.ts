import { REF_LENGTH } from './constants';

export function getRefFromPosition(position: number, chunkSize: number): number {
  return Math.floor(position / chunkSize);
}

export function getPositionFromRef(ref: number, chunkSize: number): number {
  return ref * chunkSize;
}

export function serializeRef(ref: number, length?: number): string {
  return ref.toString().padEnd(length ?? REF_LENGTH, ' ');
}

export function deserializeRef(ref: string): number {
  return parseInt(ref, 10);
}

export function getCallee(error = new Error('foo'), lineno = 3): string | undefined {
  const stackOrigin = error.stack?.split('\n')[lineno];
  const match = stackOrigin?.match(/^\s*at\s+([^.\s]+\.)?([^\s]+)/);
  if (match) {
    return match[2];
  }
}
