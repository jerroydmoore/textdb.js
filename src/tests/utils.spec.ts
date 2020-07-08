import { getCallee, getRefFromPosition, getPositionFromRef, serializeRef, deserializeRef } from '../utils';

test('getRefFromPosition should return a reference from position', () => {
  expect(getRefFromPosition(100, 10)).toBe(10);
  expect(getRefFromPosition(107, 10)).toBe(10);
});

test('getPositionFromRef() should return a position from a reference', () => {
  expect(getPositionFromRef(8, 8)).toBe(64);
});

test('serializeRef() should serialize a reference', () => {
  expect(serializeRef(1)).toBe('1      ');
  expect(serializeRef(-1, 10)).toBe('-1        ');
});

test('deserializeRef() should deserialize a reference', () => {
  expect(deserializeRef('-1     ')).toBe(-1);
  expect(deserializeRef('100   ')).toBe(100);
});

test('getCallee should return the function callee name', () => {
  function foo() {
    return getCallee();
  }
  function bar() {
    return foo();
  }
  expect(bar()).toBe('bar');
});
