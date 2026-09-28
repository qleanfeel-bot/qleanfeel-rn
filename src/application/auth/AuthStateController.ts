import type { AuthError } from '../../domain/auth/errors/AuthError';
import type { AuthApi } from './ports/AuthApi';
import type { AuthProviderAdapter } from './ports/AuthProviderAdapter';
import type { AuthState } from './AuthState';

const initialState: AuthState = { status: 'unknown' };
type AuthStateListener = (state: AuthState) => void;

function sameUser(left: AuthenticatedState['user'], right: AuthenticatedState['user']): boolean {
  return (
    left.id === right.id &&
    left.status === right.status &&
    left.createdAt.getTime() === right.createdAt.getTime() &&
    left.updatedAt.getTime() === right.updatedAt.getTime()
  );
}

type AuthenticatedState = Extract<AuthState, { readonly status: 'authenticated' }>;

function sameState(left: AuthState, right: AuthState): boolean {
  if (left.status !== right.status) {
    return false;
  }

  switch (left.status) {
    case 'unknown':
    case 'unauthenticated':
    case 'authenticating':
    case 'awaitingOtp':
    case 'sessionExpired':
      return true;
    case 'authenticated':
      return right.status === 'authenticated' && sameUser(left.user, right.user);
    case 'error':
      return right.status === 'error' && left.error.code === right.error.code;
  }
}

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
  private readonly listeners = new Set<AuthStateListener>();

  constructor(
    private readonly provider: AuthProviderAdapter,
    private readonly api: AuthApi,
  ) {}

  get state(): AuthState {
    return this.currentState;
  }

  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);

    return () => {
      this.listeners.delete(listener);
    };
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
      if (this.isCurrentOperation(operationVersion)) {
        this.setState({ status: 'awaitingOtp' });
      }
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
    if (sameState(this.currentState, state)) {
      return;
    }

    this.currentState = state;
    for (const listener of [...this.listeners]) {
      if (this.listeners.has(listener)) {
        listener(state);
      }
    }
  }
}
