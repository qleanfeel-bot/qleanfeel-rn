import type { AuthError } from '../../domain/auth/errors/AuthError';
import type { User } from '../../domain/auth/entities/User';

/** Provider-independent state; external credentials are never retained here. */
export type AuthState =
  | { readonly status: 'unknown' }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'authenticating' }
  // AuthApi currently returns User only, so the controller does not synthesize an AuthSession.
  | { readonly status: 'authenticated'; readonly user: User }
  | { readonly status: 'sessionExpired' }
  | { readonly status: 'error'; readonly error: AuthError };
