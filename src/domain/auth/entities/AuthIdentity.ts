import type { UserId } from './User';

export type AuthIdentityId = string;
export type AuthProvider = 'firebase';

export interface AuthIdentity {
  readonly id: AuthIdentityId;
  readonly userId: UserId;
  readonly provider: AuthProvider;
  readonly providerSubject: string;
  readonly createdAt: Date;
  readonly lastAuthenticatedAt: Date;
}
