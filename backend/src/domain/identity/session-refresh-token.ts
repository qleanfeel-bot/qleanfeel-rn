export class SessionRefreshToken {
  constructor(
    readonly id: string,
    readonly sessionId: string,
    readonly tokenHash: string,
    readonly createdAt: Date,
    readonly expiresAt: Date,
    readonly consumedAt: Date | null,
    readonly revokedAt: Date | null,
    readonly replacedById: string | null,
  ) {}

  get isUsable(): boolean {
    return this.consumedAt === null && this.revokedAt === null;
  }
}
