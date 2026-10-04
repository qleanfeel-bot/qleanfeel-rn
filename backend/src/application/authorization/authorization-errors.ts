/** An authenticated principal was denied an application operation. */
export class AuthorizationDeniedError extends Error {
  constructor() {
    super('The requested operation is not permitted.');
    this.name = 'AuthorizationDeniedError';
  }
}
