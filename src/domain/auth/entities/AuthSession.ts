import type { UserId } from './User';

export type AuthSessionId = string;

export const AUTH_SESSION_STATUSES = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
} as const;

export type AuthSessionStatus =
  (typeof AUTH_SESSION_STATUSES)[keyof typeof AUTH_SESSION_STATUSES];

/** Qleanfeel authenticated session state; external provider credentials do not belong here. */
export interface AuthSession {
  readonly id: AuthSessionId;
  readonly userId: UserId;
  readonly status: AuthSessionStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt?: Date;
}
