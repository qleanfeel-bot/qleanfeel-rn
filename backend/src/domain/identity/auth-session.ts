export type AuthSessionStatus = 'active' | 'revoked';

export class AuthSession {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly status: AuthSessionStatus,
    readonly createdAt: Date,
    readonly expiresAt: Date,
    readonly revokedAt: Date | null,
  ) {}

  static create(id: string, userId: string, now: Date, expiresAt: Date) {
    return new AuthSession(id, userId, 'active', now, expiresAt, null);
  }

  get isActive(): boolean {
    return this.status === 'active' && this.revokedAt === null;
  }
}
