import type { User } from '../../../domain/auth/entities/User';
import type { ProviderCredential } from '../ProviderCredential';
import type { AuthApi } from '../ports/AuthApi';
import type { AuthProviderAdapter } from '../ports/AuthProviderAdapter';
import type { AuthState } from '../AuthState';
import { AuthStateController } from '../AuthStateController';

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
    restoreSession: jest.fn().mockResolvedValue(null),
    signOut: jest.fn().mockResolvedValue(undefined),
  };
  const api: jest.Mocked<AuthApi> = {
    bootstrap: jest.fn().mockResolvedValue(user),
    getCurrentUser: jest.fn().mockResolvedValue(user),
  };

  return { controller: new AuthStateController(provider, api), provider, api };
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
    const { controller, provider, api } = createController();

    await controller.verifyOtp('+10000000000', '123456');

    expect(provider.verifyOtp).toHaveBeenCalledWith('+10000000000', '123456');
    expect(api.bootstrap).toHaveBeenCalledWith(providerCredential);
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

    expect(controller.state).toEqual({ status: 'error', error: { code: 'NetworkError' } });
    expect(controller.state.status).not.toBe('authenticated');
    expect(JSON.stringify(controller.state)).not.toContain('private bootstrap response details');
    expect(JSON.stringify(states)).not.toContain(providerCredential);
  });

  it('maps current-user API rejection during restoration without exposing details or credentials', async () => {
    const { controller, provider, api } = createController();
    const states: AuthState[] = [];
    controller.subscribe(state => states.push(state));
    provider.restoreSession.mockResolvedValue(providerCredential);
    api.getCurrentUser.mockRejectedValue({
      code: 'AuthenticationRequired',
      message: 'private current-user response details',
      credential: providerCredential,
    });

    await controller.initialize();

    expect(controller.state).toEqual({
      status: 'error',
      error: { code: 'AuthenticationRequired' },
    });
    expect(controller.state.status).not.toBe('authenticated');
    expect(JSON.stringify(controller.state)).not.toContain('private current-user response details');
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
    let resolveBootstrap: (value: User | PromiseLike<User>) => void = () => {};
    let markBootstrapStarted: () => void = () => {};
    const bootstrapStarted = new Promise<void>(resolve => {
      markBootstrapStarted = resolve;
    });
    api.bootstrap.mockImplementation(
      () =>
        new Promise<User>(resolve => {
          resolveBootstrap = resolve;
          markBootstrapStarted();
        }),
    );

    const authentication = controller.verifyOtp('+10000000000', '123456');
    await bootstrapStarted;
    await controller.logout();
    expect(controller.state).toEqual({ status: 'unauthenticated' });

    resolveBootstrap(user);
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

    expect(controller.state).toEqual({ status: 'error', error: { code: 'NetworkError' } });
    expect(JSON.stringify(controller.state)).not.toContain('private provider sign-out details');
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
    let resolveBootstrap: (value: User | PromiseLike<User>) => void = () => {};
    let markBootstrapStarted: () => void = () => {};
    const bootstrapStarted = new Promise<void>(resolve => {
      markBootstrapStarted = resolve;
    });
    api.bootstrap.mockImplementation(
      () =>
        new Promise<User>(resolve => {
          resolveBootstrap = resolve;
          markBootstrapStarted();
        }),
    );

    const authentication = controller.verifyOtp('+10000000000', '123456');
    await bootstrapStarted;
    controller.expireSession();
    resolveBootstrap(user);
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

  it('restores to unauthenticated when there is no provider session', async () => {
    const { controller, provider, api } = createController();

    await controller.initialize();

    expect(provider.restoreSession).toHaveBeenCalledTimes(1);
    expect(api.getCurrentUser).not.toHaveBeenCalled();
    expect(controller.state).toEqual({ status: 'unauthenticated' });
  });

  it('restores provider state through the API to the current Qleanfeel User', async () => {
    const { controller, provider, api } = createController();
    provider.restoreSession.mockResolvedValue(providerCredential);

    await controller.initialize();

    expect(api.getCurrentUser).toHaveBeenCalledWith(providerCredential);
    expect(controller.state).toEqual({ status: 'authenticated', user });
  });

  it('does not put a provider credential in AuthState or the Qleanfeel User', async () => {
    const { controller } = createController();
    const states: AuthState[] = [];
    controller.subscribe(state => states.push(state));

    await controller.verifyOtp('+10000000000', '123456');

    expect(controller.state).toEqual({ status: 'authenticated', user });
    expect(states.every(state => !JSON.stringify(state)?.includes(providerCredential))).toBe(true);
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
