export interface VerifiedExternalIdentity {
  readonly provider: string;
  readonly providerSubject: string;
}

export abstract class IdentityProofVerifier {
  abstract verify(
    providerCredential: string,
  ): Promise<VerifiedExternalIdentity>;
}
