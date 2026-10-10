import type { User } from '../../../domain/auth/entities/User';
import type { ProviderCredential } from '../ProviderCredential';
import type { SecureTokenStore } from '../ports/SecureTokenStore';
import type {
  SessionApi,
  QleanfeelSessionCredentials,
} from '../ports/SessionApi';
import { SessionManager } from '../SessionManager';

const user: User = {
  id: 'user-1',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const grant = (version: number): QleanfeelSessionCredentials => ({
  user,
  accessToken: `access-${version}`,
  refreshToken: `refresh-${version}`,
});

function createHarness() {
  let storedToken: string | null = null;
  const tokenStore: jest.Mocked<SecureTokenStore> = {
    getRefreshToken: jest.fn(async () => storedToken),
    setRefreshToken: jest.fn(async token => {
      storedToken = token;
    }),
    deleteRefreshToken: jest.fn(async () => {
      storedToken = null;
    }),
  };
  const api: jest.Mocked<SessionApi> = {
    bootstrap: jest.fn().mockResolvedValue(grant(1)),
    refresh: jest.fn().mockResolvedValue(grant(2)),
    logout: jest.fn().mockResolvedValue(undefined),
  };
  const manager = new SessionManager(api, tokenStore);
  return { manager, api, tokenStore, readStored: () => storedToken };
}

describe('SessionManager', () => {
  it('persists the refresh token before exposing an active access token', async () => {
    const { manager, tokenStore } = createHarness();
    const proof = 'provider-proof' as ProviderCredential;

    await expect(manager.bootstrap(proof)).resolves.toEqual(user);

    expect(tokenStore.setRefreshToken).toHaveBeenCalledWith('refresh-1');
    await expect(manager.getAccessToken()).resolves.toBe('access-1');
  });

  it('fails bootstrap closed and attempts cleanup and server revocation when secure persistence fails', async () => {
    const { manager, api, tokenStore } = createHarness();
    tokenStore.setRefreshToken.mockRejectedValue(
      new Error('private storage detail'),
    );

    await expect(
      manager.bootstrap('proof' as ProviderCredential),
    ).rejects.toMatchObject({
      code: 'SecureStorageError',
    });

    expect(tokenStore.deleteRefreshToken).toHaveBeenCalled();
    expect(api.logout).toHaveBeenCalledWith('access-1');
    await expect(manager.getAccessToken()).resolves.toBeNull();
  });

  it('restores with the stored refresh token and persists its rotated replacement', async () => {
    const { manager, api, tokenStore } = createHarness();
    tokenStore.getRefreshToken.mockResolvedValueOnce('old-refresh');
    api.refresh.mockResolvedValue(grant(2));

    await expect(manager.restoreSession()).resolves.toEqual(user);

    expect(api.refresh).toHaveBeenCalledWith('old-refresh');
    expect(tokenStore.setRefreshToken).toHaveBeenCalledWith('refresh-2');
    await expect(manager.getAccessToken()).resolves.toBe('access-2');
  });

  it('restores unauthenticated when no refresh token exists', async () => {
    const { manager, api } = createHarness();

    await expect(manager.restoreSession()).resolves.toBeNull();
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('fails closed on secure-store read failure', async () => {
    const { manager, api, tokenStore } = createHarness();
    tokenStore.getRefreshToken.mockRejectedValue(
      new Error('private storage detail'),
    );

    await expect(manager.restoreSession()).rejects.toMatchObject({
      code: 'SecureStorageError',
    });
    expect(api.refresh).not.toHaveBeenCalled();
    await expect(manager.getAccessToken()).resolves.toBeNull();
  });

  it('shares one refresh and replaces the stored token for concurrent unauthorized requests', async () => {
    const { manager, api, tokenStore } = createHarness();
    await manager.bootstrap('proof' as ProviderCredential);
    let complete!: (credentials: QleanfeelSessionCredentials) => void;
    api.refresh.mockImplementation(
      () =>
        new Promise(resolve => {
          complete = resolve;
        }),
    );

    const first = manager.refreshAccessToken('access-1');
    const second = manager.refreshAccessToken('access-1');
    await Promise.resolve();
    await Promise.resolve();
    expect(api.refresh).toHaveBeenCalledTimes(1);
    complete(grant(2));

    await expect(Promise.all([first, second])).resolves.toEqual([
      'access-2',
      'access-2',
    ]);
    expect(tokenStore.setRefreshToken).toHaveBeenLastCalledWith('refresh-2');
    expect(api.refresh).toHaveBeenCalledWith('refresh-1');
  });

  it('uses a newer access token for a late 401 instead of rotating again', async () => {
    const { manager, api } = createHarness();
    await manager.bootstrap('proof' as ProviderCredential);
    await manager.refreshAccessToken('access-1');

    await expect(manager.refreshAccessToken('access-1')).resolves.toBe(
      'access-2',
    );
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });

  it('does not replay a refresh token after an ambiguous failure and requires reauthentication', async () => {
    const { manager, api, tokenStore, readStored } = createHarness();
    await manager.bootstrap('proof' as ProviderCredential);
    api.refresh.mockRejectedValue({
      code: 'NetworkError',
      message: 'private details',
    });
    const expired = jest.fn();
    manager.subscribeToExpiration(expired);

    await expect(manager.refreshAccessToken('access-1')).rejects.toMatchObject({
      code: 'SessionExpired',
    });
    await expect(manager.getAccessToken()).resolves.toBeNull();
    expect(readStored()).toBeNull();
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(tokenStore.deleteRefreshToken).toHaveBeenCalled();
    expect(expired).toHaveBeenCalledWith('SessionExpired');
  });

  it('clears the consumed refresh token when the backend rejects it', async () => {
    const { manager, api, tokenStore, readStored } = createHarness();
    await manager.bootstrap('proof' as ProviderCredential);
    api.refresh.mockRejectedValue({ code: 'Unauthorized' });

    await expect(manager.refreshAccessToken('access-1')).rejects.toMatchObject({
      code: 'SessionExpired',
    });
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(tokenStore.deleteRefreshToken).toHaveBeenCalled();
    expect(readStored()).toBeNull();
    await expect(manager.getAccessToken()).resolves.toBeNull();
  });

  it('does not keep the previous token when persisting a rotated token fails', async () => {
    const { manager, api, tokenStore } = createHarness();
    await manager.bootstrap('proof' as ProviderCredential);
    tokenStore.setRefreshToken.mockRejectedValue(
      new Error('private secure storage detail'),
    );

    await expect(manager.refreshAccessToken('access-1')).rejects.toMatchObject({
      code: 'SecureStorageError',
    });
    await expect(manager.getAccessToken()).resolves.toBeNull();
    expect(tokenStore.deleteRefreshToken).toHaveBeenCalled();
    expect(api.logout).toHaveBeenCalledWith('access-2');
  });

  it('terminates a refresh once the backend reports a suspended account', async () => {
    const { manager, api, readStored } = createHarness();
    await manager.bootstrap('proof' as ProviderCredential);
    api.refresh.mockRejectedValue({
      code: 'Forbidden',
      message: 'private account detail',
    });
    const expired = jest.fn();
    manager.subscribeToExpiration(expired);

    await expect(manager.refreshAccessToken('access-1')).rejects.toMatchObject({
      code: 'AccountUnavailable',
    });
    expect(expired).toHaveBeenCalledWith('AccountUnavailable');
    expect(readStored()).toBeNull();
    await expect(manager.getAccessToken()).resolves.toBeNull();
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });

  it('clears local access before logout network work and reports unconfirmed revocation as false', async () => {
    const { manager, api, readStored } = createHarness();
    await manager.bootstrap('proof' as ProviderCredential);
    api.logout.mockRejectedValue(new Error('offline'));

    const resultPromise = manager.logout();
    await expect(manager.getAccessToken()).resolves.toBeNull();
    await expect(resultPromise).resolves.toEqual({ serverRevoked: false });
    expect(readStored()).toBeNull();
    expect(api.logout).toHaveBeenCalledWith('access-1');
  });

  it('keeps protected access blocked and reports incomplete cleanup if secure deletion fails', async () => {
    const { manager, tokenStore } = createHarness();
    await manager.bootstrap('proof' as ProviderCredential);
    tokenStore.deleteRefreshToken.mockRejectedValue(
      new Error('private storage detail'),
    );

    await expect(manager.logout()).rejects.toMatchObject({
      code: 'LogoutIncomplete',
    });
    await expect(manager.getAccessToken()).resolves.toBeNull();
  });
});
