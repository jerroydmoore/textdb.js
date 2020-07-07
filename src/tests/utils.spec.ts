import { getCallee } from '../utils';

describe('getCallee', () => {
  it('returns the function callee name', () => {
    function foo() {
      return getCallee();
    }
    function bar() {
      return foo();
    }
    expect(bar()).toBe('bar');
  });
});
