import type { User } from '../../../domain/auth/entities/User';
import type { ProviderCredential } from '../ProviderCredential';
import type { AuthApi } from '../ports/AuthApi';
import type { AuthProviderAdapter } from '../ports/AuthProviderAdapter';
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

  it('authenticates through the provider and then the Qleanfeel API', async () => {
    const { controller, provider, api } = createController();

    await controller.verifyOtp('+10000000000', '123456');

    expect(provider.verifyOtp).toHaveBeenCalledWith('+10000000000', '123456');
    expect(api.bootstrap).toHaveBeenCalledWith(providerCredential);
    expect(controller.state).toEqual({ status: 'authenticated', user });
  });

  it('becomes unauthenticated after provider sign-out', async () => {
    const { controller, provider } = createController();
    await controller.verifyOtp('+10000000000', '123456');

    await controller.logout();

    expect(provider.signOut).toHaveBeenCalledTimes(1);
    expect(controller.state).toEqual({ status: 'unauthenticated' });
  });

  it('represents session expiration without retaining user or credential data', () => {
    const { controller } = createController();

    controller.expireSession();

    expect(controller.state).toEqual({ status: 'sessionExpired' });
  });

  it('ignores an authentication result that completes after session expiration', async () => {
    const { controller, api } = createController();
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

    await controller.verifyOtp('+10000000000', '123456');

    expect(controller.state).toEqual({ status: 'authenticated', user });
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
