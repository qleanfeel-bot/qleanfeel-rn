export class InvalidIdentityProofError extends Error {
  constructor() {
    super('Identity proof is invalid.');
    this.name = 'InvalidIdentityProofError';
  }
}

export class IdentityProviderUnavailableError extends Error {
  constructor() {
    super('Identity provider is unavailable.');
    this.name = 'IdentityProviderUnavailableError';
  }
}

export class AuthenticationConfigurationError extends Error {
  constructor() {
    super('Authentication is not configured.');
    this.name = 'AuthenticationConfigurationError';
  }
}

export class IdentityProvisioningConflictError extends Error {
  constructor() {
    super('Identity provisioning conflicted with another request.');
    this.name = 'IdentityProvisioningConflictError';
  }
}

export class AccountSuspendedError extends Error {
  constructor() {
    super('This account is not available.');
    this.name = 'AccountSuspendedError';
  }
}

export class InvalidRefreshCredentialError extends Error {
  constructor() {
    super('Refresh credential is invalid.');
    this.name = 'InvalidRefreshCredentialError';
  }
}

export class InvalidAccessCredentialError extends Error {
  constructor() {
    super('Access credential is invalid.');
    this.name = 'InvalidAccessCredentialError';
  }
}

export class AuthenticatedAccountUnavailableError extends Error {
  constructor() {
    super('Authenticated account is not available.');
    this.name = 'AuthenticatedAccountUnavailableError';
  }
}
