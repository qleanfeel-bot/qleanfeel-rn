export type AuthErrorCode =
  | 'InvalidCode'
  | 'CodeExpired'
  | 'TooManyAttempts'
  | 'TooManyRequests'
  | 'NetworkError'
  | 'AuthenticationRequired'
  | 'SessionExpired'
  | 'UnknownAuthError';

export interface AuthError {
  readonly code: AuthErrorCode;
}
