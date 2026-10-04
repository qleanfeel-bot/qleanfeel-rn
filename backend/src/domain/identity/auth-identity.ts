export class AuthIdentity {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly provider: string,
    readonly providerSubject: string,
    readonly createdAt: Date,
    readonly lastAuthenticatedAt: Date,
  ) {}
}
