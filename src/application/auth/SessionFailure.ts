export type SessionFailureCode =
  | 'SessionExpired'
  | 'SecureStorageError'
  | 'LogoutIncomplete'
  | 'AccountUnavailable'
  | 'AuthenticationRequired'
  | 'NetworkError'
  | 'UnknownAuthError';

/** Safe application failure. It never retains credentials or provider errors. */
export class SessionFailure extends Error {
  public constructor(public readonly code: SessionFailureCode) {
    super(code);
    this.name = 'SessionFailure';
  }
}
