import type { User } from '../../domain/auth/entities/User';
import type { ProviderCredential } from './ProviderCredential';
import { SessionFailure } from './SessionFailure';
import type { AccessTokenProvider } from './ports/AccessTokenProvider';
import type { SecureTokenStore } from './ports/SecureTokenStore';
import type {
  QleanfeelSessionCredentials,
  SessionApi,
} from './ports/SessionApi';

type ExpirationListener = (
  code:
    | 'SessionExpired'
    | 'AccountUnavailable'
    | 'SecureStorageError'
    | 'LogoutIncomplete',
) => void;

/** Owns Qleanfeel credentials, refresh coordination, and local session state. */
export class SessionManager implements AccessTokenProvider {
  private accessToken: string | null = null;
  private active = false;
  private generation = 0;
  private refreshInFlight: Promise<string> | null = null;
  private storageQueue: Promise<void> = Promise.resolve();
  private readonly expirationListeners = new Set<ExpirationListener>();

  public constructor(
    private readonly api: SessionApi,
    private readonly tokenStore: SecureTokenStore,
  ) {}

  public subscribeToExpiration(listener: ExpirationListener): () => void {
    this.expirationListeners.add(listener);
    return () => this.expirationListeners.delete(listener);
  }

  public async bootstrap(
    providerCredential: ProviderCredential,
  ): Promise<User> {
    this.clearMemory();
    const operation = ++this.generation;
    try {
      await this.enqueueStorage(() => this.tokenStore.deleteRefreshToken());
    } catch {
      throw new SessionFailure('SecureStorageError');
    }
    let credentials: QleanfeelSessionCredentials;
    try {
      credentials = await this.api.bootstrap(providerCredential);
    } catch (error) {
      throw safeFailure(error);
    }

    try {
      await this.enqueueStorage(async () => {
        if (operation !== this.generation)
          throw new SessionFailure('SessionExpired');
        await this.tokenStore.setRefreshToken(credentials.refreshToken);
      });
    } catch {
      this.clearMemory();
      await this.bestEffortDelete();
      await this.bestEffortLogout(credentials.accessToken);
      throw new SessionFailure('SecureStorageError');
    }

    if (operation !== this.generation) {
      await this.bestEffortDelete();
      throw new SessionFailure('SessionExpired');
    }
    this.accessToken = credentials.accessToken;
    this.active = true;
    return credentials.user;
  }

  public async restoreSession(): Promise<User | null> {
    this.clearMemory();
    const operation = ++this.generation;
    let refreshToken: string | null;
    try {
      refreshToken = await this.tokenStore.getRefreshToken();
    } catch {
      throw new SessionFailure('SecureStorageError');
    }
    if (refreshToken === null) return null;

    try {
      const credentials = await this.api.refresh(refreshToken);
      await this.persistRotation(operation, credentials);
      return credentials.user;
    } catch (error) {
      await this.terminate(operation, false);
      throw safeFailure(error, true);
    }
  }

  public async getAccessToken(): Promise<string | null> {
    return this.active ? this.accessToken : null;
  }

  /** Called by HttpTransport after a protected request receives 401. */
  public async refreshAccessToken(failedAccessToken: string): Promise<string> {
    if (!this.active || this.accessToken === null) {
      throw new SessionFailure('SessionExpired');
    }
    // A concurrent request may have already replaced this failed token.
    if (this.accessToken !== failedAccessToken) return this.accessToken;
    if (this.refreshInFlight) return this.refreshInFlight;

    const operation = this.generation;
    const refresh = this.performRefresh(operation);
    this.refreshInFlight = refresh;
    try {
      return await refresh;
    } finally {
      if (this.refreshInFlight === refresh) this.refreshInFlight = null;
    }
  }

  public async expireAfterUnauthorized(accessToken: string): Promise<void> {
    if (this.accessToken !== accessToken) return;
    await this.terminate(this.generation, true);
  }

  public expire(): void {
    this.clearMemory();
    this.generation += 1;
    this.notifyExpired('SessionExpired');
    this.enqueueStorage(() => this.tokenStore.deleteRefreshToken()).catch(
      () => {
        this.notifyExpired('LogoutIncomplete');
      },
    );
  }

  /** Clears local access first; server revocation is best effort and explicit. */
  public async logout(): Promise<{ readonly serverRevoked: boolean }> {
    const accessToken = this.accessToken;
    ++this.generation;
    this.clearMemory();

    let deletionFailed = false;
    try {
      await this.enqueueStorage(() => this.tokenStore.deleteRefreshToken());
    } catch {
      deletionFailed = true;
    }

    const serverRevoked = accessToken
      ? await this.bestEffortLogout(accessToken)
      : false;
    if (deletionFailed) throw new SessionFailure('LogoutIncomplete');
    return { serverRevoked };
  }

  private async performRefresh(operation: number): Promise<string> {
    let oldRefreshToken: string | null;
    try {
      oldRefreshToken = await this.tokenStore.getRefreshToken();
    } catch {
      await this.terminate(operation, true, 'SecureStorageError');
      throw new SessionFailure('SecureStorageError');
    }
    if (oldRefreshToken === null) {
      await this.terminate(operation, true);
      throw new SessionFailure('SessionExpired');
    }

    try {
      const credentials = await this.api.refresh(oldRefreshToken);
      await this.persistRotation(operation, credentials);
      return credentials.accessToken;
    } catch (error) {
      const failure = safeFailure(error, true);
      await this.terminate(
        operation,
        true,
        failure.code === 'AccountUnavailable' ||
          failure.code === 'SecureStorageError' ||
          failure.code === 'LogoutIncomplete'
          ? failure.code
          : 'SessionExpired',
      );
      throw failure;
    }
  }

  private async persistRotation(
    operation: number,
    credentials: QleanfeelSessionCredentials,
  ): Promise<void> {
    await this.enqueueStorage(async () => {
      if (operation !== this.generation) {
        throw new SessionFailure('SessionExpired');
      }
      await this.tokenStore.setRefreshToken(credentials.refreshToken);
    }).catch(async error => {
      if (error instanceof SessionFailure) throw error;
      await this.bestEffortDelete();
      await this.bestEffortLogout(credentials.accessToken);
      throw new SessionFailure('SecureStorageError');
    });

    if (operation !== this.generation)
      throw new SessionFailure('SessionExpired');
    this.accessToken = credentials.accessToken;
    this.active = true;
  }

  private async terminate(
    operation: number,
    notify: boolean,
    reason:
      | 'SessionExpired'
      | 'AccountUnavailable'
      | 'SecureStorageError'
      | 'LogoutIncomplete' = 'SessionExpired',
  ): Promise<void> {
    if (operation !== this.generation) return;
    this.clearMemory();
    this.generation += 1;
    if (notify) this.notifyExpired(reason);
    try {
      await this.enqueueStorage(() => this.tokenStore.deleteRefreshToken());
    } catch {
      if (notify) this.notifyExpired('LogoutIncomplete');
      throw new SessionFailure('LogoutIncomplete');
    }
  }

  private clearMemory(): void {
    this.active = false;
    this.accessToken = null;
    this.refreshInFlight = null;
  }

  private notifyExpired(
    code:
      | 'SessionExpired'
      | 'AccountUnavailable'
      | 'SecureStorageError'
      | 'LogoutIncomplete',
  ): void {
    for (const listener of [...this.expirationListeners]) listener(code);
  }

  private async bestEffortDelete(): Promise<void> {
    try {
      await this.enqueueStorage(() => this.tokenStore.deleteRefreshToken());
    } catch {
      // Callers retain the original safe failure and the session stays blocked.
    }
  }

  private async bestEffortLogout(accessToken: string): Promise<boolean> {
    try {
      await this.api.logout(accessToken);
      return true;
    } catch {
      return false;
    }
  }

  private enqueueStorage(operation: () => Promise<void>): Promise<void> {
    const result = this.storageQueue.then(operation, operation);
    this.storageQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function safeFailure(error: unknown, refreshFailure = false): SessionFailure {
  if (error instanceof SessionFailure) return error;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    if (code === 'Forbidden') return new SessionFailure('AccountUnavailable');
    if (code === 'Unauthorized' && !refreshFailure) {
      return new SessionFailure('AuthenticationRequired');
    }
    if (code === 'NetworkError' && !refreshFailure)
      return new SessionFailure('NetworkError');
  }
  return new SessionFailure(
    refreshFailure ? 'SessionExpired' : 'UnknownAuthError',
  );
}
