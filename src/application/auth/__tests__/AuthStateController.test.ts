import type { User } from '../../../domain/auth/entities/User';
import type { ProviderCredential } from '../ProviderCredential';
import type {
  SessionApi,
  QleanfeelSessionCredentials,
} from '../ports/SessionApi';
import type { AuthProviderAdapter } from '../ports/AuthProviderAdapter';
import type { SecureTokenStore } from '../ports/SecureTokenStore';
import type { AuthState } from '../AuthState';
import { AuthStateController } from '../AuthStateController';
import { SessionManager } from '../SessionManager';

const user: User = {
  id: 'qleanfeel-user-1',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const providerCredential = 'opaque-provider-credential' as ProviderCredential;

function createController() {
  const provider: jest.Mocked<AuthProviderAdapter> = {
    requestOtp: jest.fn().mockResolvedValue(undefined),
    verifyOtp: jest.fn().mockResolvedValue(providerCredential),
    signOut: jest.fn().mockResolvedValue(undefined),
  };
  const credentials: QleanfeelSessionCredentials = {
    user,
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  };
  const api: jest.Mocked<SessionApi> = {
    bootstrap: jest.fn().mockResolvedValue(credentials),
    refresh: jest.fn().mockResolvedValue(credentials),
    logout: jest.fn().mockResolvedValue(undefined),
  };
  const tokenStore: jest.Mocked<SecureTokenStore> = {
    getRefreshToken: jest.fn().mockResolvedValue(null),
    setRefreshToken: jest.fn().mockResolvedValue(undefined),
    deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
  };
  const session = new SessionManager(api, tokenStore);

  return {
    controller: new AuthStateController(provider, session),
    provider,
    api,
    tokenStore,
    session,
  };
}

describe('AuthStateController', () => {
  it('starts in the unknown state', () => {
    const { controller } = createController();

    expect(controller.state).toEqual({ status: 'unknown' });
  });

  it('immediately emits the current state to a new subscriber', () => {
    const { controller } = createController();
    const listener = jest.fn();

    controller.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ status: 'unknown' });
  });

  it('notifies on state changes but not repeated equivalent states', async () => {
    const { controller } = createController();
    const states: AuthState[] = [];
    controller.subscribe(state => states.push(state));

    await controller.requestOtp('+10000000000');
    controller.expireSession();
    controller.expireSession();

    expect(states.map(state => state.status)).toEqual([
      'unknown',
      'authenticating',
      'awaitingOtp',
      'sessionExpired',
    ]);
  });

  it('notifies multiple subscribers', () => {
    const { controller } = createController();
    const first = jest.fn();
    const second = jest.fn();

    controller.subscribe(first);
    controller.subscribe(second);
    controller.expireSession();

    expect(first).toHaveBeenNthCalledWith(2, { status: 'sessionExpired' });
    expect(second).toHaveBeenNthCalledWith(2, { status: 'sessionExpired' });
  });

  it('stops notifying an unsubscribed listener', () => {
    const { controller } = createController();
    const listener = jest.fn();
    const unsubscribe = controller.subscribe(listener);

    unsubscribe();
    controller.expireSession();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('allows unsubscribe to be called more than once', () => {
    const { controller } = createController();
    const listener = jest.fn();
    const unsubscribe = controller.subscribe(listener);

    expect(() => {
      unsubscribe();
      unsubscribe();
      controller.expireSession();
    }).not.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('authenticates through the provider and then the Qleanfeel API', async () => {
    const { controller, provider, api, tokenStore } = createController();

    await controller.verifyOtp('+10000000000', '123456');

    expect(provider.verifyOtp).toHaveBeenCalledWith('+10000000000', '123456');
    expect(api.bootstrap).toHaveBeenCalledWith(providerCredential);
    expect(tokenStore.setRefreshToken).toHaveBeenCalledWith(
      'test-refresh-token',
    );
    expect(controller.state).toEqual({ status: 'authenticated', user });
  });

  it('maps bootstrap API rejection without exposing details or credentials', async () => {
    const { controller, api } = createController();
    const states: AuthState[] = [];
    controller.subscribe(state => states.push(state));
    api.bootstrap.mockRejectedValue({
      code: 'NetworkError',
      message: 'private bootstrap response details',
      credential: providerCredential,
    });

    await controller.verifyOtp('+10000000000', '123456');

    expect(controller.state).toEqual({
      status: 'error',
      error: { code: 'NetworkError' },
    });
    expect(controller.state.status).not.toBe('authenticated');
    expect(JSON.stringify(controller.state)).not.toContain(
      'private bootstrap response details',
    );
    expect(JSON.stringify(states)).not.toContain(providerCredential);
  });

  it('maps refresh rejection during restoration without exposing details or credentials', async () => {
    const { controller, api, tokenStore } = createController();
    const states: AuthState[] = [];
    controller.subscribe(state => states.push(state));
    tokenStore.getRefreshToken.mockResolvedValue('old-refresh-token');
    api.refresh.mockRejectedValue({
      code: 'Unauthorized',
      message: 'private refresh response details',
      credential: providerCredential,
    });

    await controller.initialize();

    expect(controller.state).toEqual({ status: 'sessionExpired' });
    expect(controller.state.status).not.toBe('authenticated');
    expect(JSON.stringify(controller.state)).not.toContain(
      'private refresh response details',
    );
    expect(JSON.stringify(states)).not.toContain(providerCredential);
  });

  it('becomes unauthenticated after provider sign-out', async () => {
    const { controller, provider } = createController();
    await controller.verifyOtp('+10000000000', '123456');

    await controller.logout();

    expect(provider.signOut).toHaveBeenCalledTimes(1);
    expect(controller.state).toEqual({ status: 'unauthenticated' });
  });

  it('does not let pending authentication override a newer logout', async () => {
    const { controller, api } = createController();
    const states: AuthState[] = [];
    controller.subscribe(state => states.push(state));
    let resolveBootstrap: (
      value:
        | QleanfeelSessionCredentials
        | PromiseLike<QleanfeelSessionCredentials>,
    ) => void = () => {};
    let markBootstrapStarted: () => void = () => {};
    const bootstrapStarted = new Promise<void>(resolve => {
      markBootstrapStarted = resolve;
    });
    api.bootstrap.mockImplementation(
      () =>
        new Promise<QleanfeelSessionCredentials>(resolve => {
          resolveBootstrap = resolve;
          markBootstrapStarted();
        }),
    );

    const authentication = controller.verifyOtp('+10000000000', '123456');
    await bootstrapStarted;
    await controller.logout();
    expect(controller.state).toEqual({ status: 'unauthenticated' });

    resolveBootstrap({
      user,
      accessToken: 'race-access',
      refreshToken: 'race-refresh',
    });
    await authentication;

    expect(controller.state).toEqual({ status: 'unauthenticated' });
    expect(states.map(state => state.status)).toEqual([
      'unknown',
      'authenticating',
      'unauthenticated',
    ]);
  });

  it('maps provider sign-out failure without exposing its message or credentials', async () => {
    const { controller, provider } = createController();
    const states: AuthState[] = [];
    controller.subscribe(state => states.push(state));
    await controller.verifyOtp('+10000000000', '123456');
    provider.signOut.mockRejectedValue({
      code: 'NetworkError',
      message: 'private provider sign-out details',
      credential: providerCredential,
    });

    await controller.logout();

    expect(controller.state).toEqual({
      status: 'error',
      error: { code: 'NetworkError' },
    });
    expect(JSON.stringify(controller.state)).not.toContain(
      'private provider sign-out details',
    );
    expect(JSON.stringify(states)).not.toContain(providerCredential);
  });

  it('represents session expiration without retaining user or credential data', () => {
    const { controller } = createController();

    controller.expireSession();

    expect(controller.state).toEqual({ status: 'sessionExpired' });
  });

  it('ignores an authentication result that completes after session expiration', async () => {
    const { controller, api } = createController();
    const states: AuthState[] = [];
    controller.subscribe(state => states.push(state));
    let resolveBootstrap: (
      value:
        | QleanfeelSessionCredentials
        | PromiseLike<QleanfeelSessionCredentials>,
    ) => void = () => {};
    let markBootstrapStarted: () => void = () => {};
    const bootstrapStarted = new Promise<void>(resolve => {
      markBootstrapStarted = resolve;
    });
    api.bootstrap.mockImplementation(
      () =>
        new Promise<QleanfeelSessionCredentials>(resolve => {
          resolveBootstrap = resolve;
          markBootstrapStarted();
        }),
    );

    const authentication = controller.verifyOtp('+10000000000', '123456');
    await bootstrapStarted;
    controller.expireSession();
    resolveBootstrap({
      user,
      accessToken: 'race-access',
      refreshToken: 'race-refresh',
    });
    await authentication;

    expect(controller.state).toEqual({ status: 'sessionExpired' });
    expect(states.map(state => state.status)).toEqual([
      'unknown',
      'authenticating',
      'sessionExpired',
    ]);
  });

  it('maps authentication failures to domain error codes without exposing messages', async () => {
    const { controller, provider } = createController();
    provider.verifyOtp.mockRejectedValue({
      code: 'InvalidCode',
      message: providerCredential,
    });

    await controller.verifyOtp('+10000000000', '123456');

    expect(controller.state).toEqual({
      status: 'error',
      error: { code: 'InvalidCode' },
    });
    expect(JSON.stringify(controller.state)).not.toContain(providerCredential);
  });

  it('restores to unauthenticated when no Qleanfeel refresh token is stored', async () => {
    const { controller, tokenStore, api } = createController();

    await controller.initialize();

    expect(tokenStore.getRefreshToken).toHaveBeenCalledTimes(1);
    expect(api.refresh).not.toHaveBeenCalled();
    expect(controller.state).toEqual({ status: 'unauthenticated' });
  });

  it('restores a Qleanfeel session by rotating the securely stored refresh token', async () => {
    const { controller, api, tokenStore } = createController();
    tokenStore.getRefreshToken.mockResolvedValue('persisted-refresh-token');

    await controller.initialize();

    expect(api.refresh).toHaveBeenCalledWith('persisted-refresh-token');
    expect(tokenStore.setRefreshToken).toHaveBeenCalledWith(
      'test-refresh-token',
    );
    expect(controller.state).toEqual({ status: 'authenticated', user });
  });

  it('does not put a provider credential in AuthState or the Qleanfeel User', async () => {
    const { controller } = createController();
    const states: AuthState[] = [];
    controller.subscribe(state => states.push(state));

    await controller.verifyOtp('+10000000000', '123456');

    expect(controller.state).toEqual({ status: 'authenticated', user });
    expect(
      states.every(
        state => !JSON.stringify(state)?.includes(providerCredential),
      ),
    ).toBe(true);
    expect(JSON.stringify(controller.state)).not.toContain(providerCredential);
    expect(JSON.stringify(user)).not.toContain(providerCredential);
    expect(controller.state.status).toBe('authenticated');
    if (controller.state.status === 'authenticated') {
      expect(controller.state.user).toEqual(user);
      expect(controller.state.user).not.toHaveProperty('accessToken');
      expect(controller.state.user).not.toHaveProperty('refreshToken');
    }
  });
});
