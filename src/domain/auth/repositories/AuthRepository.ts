import type { AuthSession } from '../entities/AuthSession';
import type { User } from '../entities/User';

/**
 * Provider-independent authentication operations required by the application.
 * Operations reject with domain-level AuthError codes when authentication fails.
 */
export interface AuthRepository {
  /** Resolves when the OTP request is accepted; provider challenge details stay internal. */
  requestOtp(phoneNumber: string): Promise<void>;

  /** Resolves on successful verification; session and user retrieval remain separate. */
  verifyOtp(phoneNumber: string, code: string): Promise<void>;

  restoreSession(): Promise<AuthSession | null>;
  getCurrentUser(): Promise<User | null>;
  logout(): Promise<void>;
}
