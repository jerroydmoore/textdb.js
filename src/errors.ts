export class InvalidArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidArgumentError';
  }
}

export class UnexpectedEndOfFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnexpectedEndOfFileError';
  }
}

export class OperationAlreadyInProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OperationAlreadyInProgressError';
  }
}

