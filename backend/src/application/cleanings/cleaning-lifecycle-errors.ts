export class CleaningNotFoundError extends Error {
  constructor() {
    super('Cleaning was not found.');
    this.name = 'CleaningNotFoundError';
  }
}

export class CleaningVersionConflictError extends Error {
  constructor() {
    super('Cleaning was changed by another operation.');
    this.name = 'CleaningVersionConflictError';
  }
}
