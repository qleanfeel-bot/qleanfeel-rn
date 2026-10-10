export type AuthErrorCode =
  | 'InvalidCode'
  | 'CodeExpired'
  | 'TooManyAttempts'
  | 'TooManyRequests'
  | 'NetworkError'
  | 'AuthenticationRequired'
  | 'SessionExpired'
  | 'SecureStorageError'
  | 'LogoutIncomplete'
  | 'AccountUnavailable'
  | 'UnknownAuthError';

export interface AuthError {
  readonly code: AuthErrorCode;
}
