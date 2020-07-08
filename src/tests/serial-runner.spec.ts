import { SerialRunner } from '../serial-runner';

class MockRunner extends SerialRunner {
  list: Array<string> = [];
  async append(str: string, waitFor: number): Promise<Array<string>> {
    return this.runNext(() => this._append(str, waitFor));
  }
  protected async _append(str: string, waitFor: number): Promise<Array<string>> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.list.push(str);
        resolve(this.list);
      }, waitFor);
    });
  }
}

test('should run in serial', async () => {
  const runner = new MockRunner();
  await Promise.all([runner.append('foo', 5), runner.append('bar', 3), runner.append('baz', 1)]);

  expect(runner.list).toEqual(['foo', 'bar', 'baz']);
});
