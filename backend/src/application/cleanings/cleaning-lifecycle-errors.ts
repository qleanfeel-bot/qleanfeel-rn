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

export class CleaningSchedulingConflictError extends Error {
  constructor() {
    super('Cleaning cannot be scheduled in its current state.');
    this.name = 'CleaningSchedulingConflictError';
  }
}
