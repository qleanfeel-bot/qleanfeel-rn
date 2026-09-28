import type { AuthError } from '../../domain/auth/errors/AuthError';
import type { AuthApi } from './ports/AuthApi';
import type { AuthProviderAdapter } from './ports/AuthProviderAdapter';
import type { AuthState } from './AuthState';

const initialState: AuthState = { status: 'unknown' };

function toAuthError(error: unknown): AuthError {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return { code: 'UnknownAuthError' };
  }

  const code = (error as { readonly code: unknown }).code;
  switch (code) {
    case 'InvalidCode':
    case 'CodeExpired':
    case 'TooManyAttempts':
    case 'TooManyRequests':
    case 'NetworkError':
    case 'AuthenticationRequired':
    case 'SessionExpired':
    case 'UnknownAuthError':
      return { code };
    default:
      return { code: 'UnknownAuthError' };
  }
}

/** Coordinates provider credentials with the backend without retaining credentials in state. */
export class AuthStateController {
  private currentState: AuthState = initialState;
  private operationVersion = 0;

  constructor(
    private readonly provider: AuthProviderAdapter,
    private readonly api: AuthApi,
  ) {}

  get state(): AuthState {
    return this.currentState;
  }

  async initialize(): Promise<void> {
    const operationVersion = this.beginOperation();
    this.setState({ status: 'authenticating' });

    try {
      const providerCredential = await this.provider.restoreSession();
      if (!this.isCurrentOperation(operationVersion)) {
        return;
      }

      if (providerCredential === null) {
        this.setState({ status: 'unauthenticated' });
        return;
      }

      const user = await this.api.getCurrentUser(providerCredential);
      if (!this.isCurrentOperation(operationVersion)) {
        return;
      }

      this.setState({ status: 'authenticated', user });
    } catch (error) {
      if (this.isCurrentOperation(operationVersion)) {
        this.setFailure(error);
      }
    }
  }

  async requestOtp(phoneNumber: string): Promise<void> {
    const operationVersion = this.beginOperation();
    this.setState({ status: 'authenticating' });

    try {
      await this.provider.requestOtp(phoneNumber);
    } catch (error) {
      if (this.isCurrentOperation(operationVersion)) {
        this.setFailure(error);
      }
    }
  }

  async verifyOtp(phoneNumber: string, code: string): Promise<void> {
    const operationVersion = this.beginOperation();
    this.setState({ status: 'authenticating' });

    try {
      const providerCredential = await this.provider.verifyOtp(phoneNumber, code);
      if (!this.isCurrentOperation(operationVersion)) {
        return;
      }

      const user = await this.api.bootstrap(providerCredential);
      if (!this.isCurrentOperation(operationVersion)) {
        return;
      }

      this.setState({ status: 'authenticated', user });
    } catch (error) {
      if (this.isCurrentOperation(operationVersion)) {
        this.setFailure(error);
      }
    }
  }

  async logout(): Promise<void> {
    const operationVersion = this.beginOperation();

    try {
      await this.provider.signOut();
      if (this.isCurrentOperation(operationVersion)) {
        this.setState({ status: 'unauthenticated' });
      }
    } catch (error) {
      if (this.isCurrentOperation(operationVersion)) {
        this.setFailure(error);
      }
    }
  }

  expireSession(): void {
    this.beginOperation();
    this.setState({ status: 'sessionExpired' });
  }

  private beginOperation(): number {
    this.operationVersion += 1;
    return this.operationVersion;
  }

  private isCurrentOperation(operationVersion: number): boolean {
    return operationVersion === this.operationVersion;
  }

  private setFailure(error: unknown): void {
    const authError = toAuthError(error);
    if (authError.code === 'SessionExpired') {
      this.setState({ status: 'sessionExpired' });
      return;
    }

    this.setState({ status: 'error', error: authError });
  }

  private setState(state: AuthState): void {
    this.currentState = state;
  }
}
