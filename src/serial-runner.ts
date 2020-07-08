export class SerialRunner {
  private lastOperation: Promise<unknown> = Promise.resolve();

  protected async runNext<T>(func: () => Promise<T>): Promise<T> {
    this.lastOperation = this.lastOperation.catch(() => null).then(func);
    return this.lastOperation as Promise<T>;
  }
}
