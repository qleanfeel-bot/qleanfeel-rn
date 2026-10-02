import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { User } from '../../../domain/auth/entities/User';
import type { ProviderCredential } from '../../../application/auth/ProviderCredential';
import type { AuthApi } from '../../../application/auth/ports/AuthApi';
import type { AuthProviderAdapter } from '../../../application/auth/ports/AuthProviderAdapter';
import type { Profile } from '../../../domain/profile/entities/Profile';
import type { ProfileRepository } from '../../../domain/profile/repositories/ProfileRepository';
import type { CalendarRepository } from '../../../domain/calendar/repositories/CalendarRepository';
import type { ManualOrderRepository } from '../../../domain/manualOrder/repositories/ManualOrderRepository';
import { CalendarService } from '../../../application/calendar/CalendarService';
import { CreateScheduledManualOrder } from '../../../application/manualOrder/CreateScheduledManualOrder';
import { ManualOrderService } from '../../../application/manualOrder/ManualOrderService';
import { AuthStateController } from '../../../application/auth/AuthStateController';
import { ProfileService } from '../../../application/profile/ProfileService';
import { AuthenticatedAppShell } from '../AuthenticatedAppShell';
import { AuthGate } from '../AuthGate';

const user: User = {
  id: 'internal-user-id',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const credential = 'opaque-test-credential' as ProviderCredential;
const profile: Profile = {
  userId: user.id,
  displayName: 'Qleanfeel User',
  phone: null,
  email: null,
  avatar: null,
  locale: null,
  country: null,
};
const mountedRenderers = new Set<ReactTestRenderer.ReactTestRenderer>();

afterEach(() => {
  ReactTestRenderer.act(() => {
    mountedRenderers.forEach(renderer => renderer.unmount());
  });
  mountedRenderers.clear();
});

function createProfileService(): ProfileService {
  const repository: ProfileRepository = {
    getProfile: jest.fn().mockResolvedValue(profile),
    updateDisplayName: jest.fn().mockResolvedValue(profile),
  };
  return new ProfileService(repository);
}

function createCalendarService(): CalendarService {
  const repository: CalendarRepository = {
    getEntries: jest.fn().mockResolvedValue([]),
    getEntry: jest.fn(async () => {
      throw new Error('not used in AuthGate tests');
    }),
    createEntry: jest.fn(async () => {
      throw new Error('not used in AuthGate tests');
    }),
    updateEntry: jest.fn(async () => {
      throw new Error('not used in AuthGate tests');
    }),
    deleteEntry: jest.fn().mockResolvedValue(undefined),
  };
  return new CalendarService(repository);
}

function createManualOrderService(): ManualOrderService {
  const repository: ManualOrderRepository = {
    getOrders: jest.fn().mockResolvedValue([]),
    createOrder: jest.fn(async () => {
      throw new Error('not used in AuthGate tests');
    }),
    getOrder: jest.fn(async () => {
      throw new Error('not used in AuthGate tests');
    }),
  };
  return new ManualOrderService(repository);
}

function createController() {
  const provider: jest.Mocked<AuthProviderAdapter> = {
    requestOtp: jest.fn().mockResolvedValue(undefined),
    verifyOtp: jest.fn().mockResolvedValue(credential),
    restoreSession: jest.fn().mockResolvedValue(null),
    signOut: jest.fn().mockResolvedValue(undefined),
  };
  const api: jest.Mocked<AuthApi> = {
    bootstrap: jest.fn().mockResolvedValue(user),
    getCurrentUser: jest.fn().mockResolvedValue(user),
  };

  return { controller: new AuthStateController(provider, api), provider, api };
}

async function renderGate(
  controller: AuthStateController,
  profileService = createProfileService(),
  calendarService = createCalendarService(),
  manualOrderService = createManualOrderService(),
) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <AuthGate
        calendarService={calendarService}
        createScheduledManualOrder={new CreateScheduledManualOrder(calendarService, manualOrderService)}
        controller={controller}
        manualOrderService={manualOrderService}
        profileService={profileService}
      />,
    );
  });
  mountedRenderers.add(renderer);
  return renderer;
}

describe('AuthGate', () => {
  it('renders a restoration surface while the state is unknown', async () => {
    const { controller } = createController();
    jest.spyOn(controller, 'initialize').mockResolvedValue(undefined);

    const renderer = await renderGate(controller);

    expect(renderer.root.findByProps({ testID: 'auth-gate-restoring' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Restoring your session…' })).toBeTruthy();
  });

  it('renders LoginScreen for unauthenticated state', async () => {
    const { controller } = createController();

    const renderer = await renderGate(controller);

    expect(controller.state).toEqual({ status: 'unauthenticated' });
    expect(renderer.root.findByProps({ testID: 'login-screen' })).toBeTruthy();
  });

  it('renders an authentication loading surface while restoration is pending', async () => {
    const { controller, provider } = createController();
    provider.restoreSession.mockReturnValue(new Promise(() => undefined));

    const renderer = await renderGate(controller);

    expect(controller.state).toEqual({ status: 'authenticating' });
    expect(renderer.root.findByProps({ testID: 'auth-gate-authenticating' })).toBeTruthy();
  });

  it('lands on Home after restoration resolves a user', async () => {
    const { controller, provider } = createController();
    provider.restoreSession.mockResolvedValue(credential);

    const renderer = await renderGate(controller);

    expect(controller.state).toEqual({ status: 'authenticated', user });
    expect(renderer.root.findByProps({ testID: 'auth-gate-authenticated' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'authenticated-app-shell' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'home-screen' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'home-greeting' }).props.children).toBe('Hello, Qleanfeel User');
    expect(renderer.root.findByProps({ testID: 'root-tab-home' })).toBeTruthy();
    const renderedOutput = JSON.stringify(renderer.toJSON());
    expect(renderedOutput).not.toContain(user.id);
    expect(renderedOutput).not.toContain(credential);
    expect(renderedOutput).not.toContain('accessToken');
    expect(renderedOutput).not.toContain('refreshToken');
  });

  it('passes the CalendarService to the authenticated shell', async () => {
    const { controller, provider } = createController();
    provider.restoreSession.mockResolvedValue(credential);
    const calendarService = createCalendarService();

    const renderer = await renderGate(controller, createProfileService(), calendarService);

    const shell = renderer.root.findByType(AuthenticatedAppShell);
    expect(shell.props.calendarService).toBe(calendarService);
  });

  it('routes Profile navigation and logout through AuthStateController.logout', async () => {
    const { controller, provider } = createController();
    provider.restoreSession.mockResolvedValue(credential);
    const logout = jest.spyOn(controller, 'logout');
    const renderer = await renderGate(controller);

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'root-tab-profile' }).props.onPress();
    });
    expect(renderer.root.findByProps({ testID: 'profile-screen' })).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'logout-button' }).props.onPress();
      await logout.mock.results[0]?.value;
    });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(provider.signOut).toHaveBeenCalledTimes(1);
    expect(controller.state).toEqual({ status: 'unauthenticated' });
    expect(renderer.root.findByProps({ testID: 'login-screen' })).toBeTruthy();
  });

  it('requests the profile for the authenticated Qleanfeel user ID', async () => {
    const { controller, provider } = createController();
    provider.restoreSession.mockResolvedValue(credential);
    const profileService = createProfileService();
    const getProfile = jest.spyOn(profileService, 'getProfile');

    await renderGate(controller, profileService);

    expect(getProfile).toHaveBeenCalledWith(user.id);
  });

  it('returns to LoginScreen when the session has expired', async () => {
    const { controller, provider } = createController();
    provider.restoreSession.mockRejectedValue({ code: 'SessionExpired' });

    const renderer = await renderGate(controller);

    expect(renderer.root.findByProps({ testID: 'login-screen' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'auth-error' }).props.children).toBe(
      'Your session has expired. Please sign in again.',
    );
  });

  it('shows a safe auth error and does not expose raw infrastructure messages', async () => {
    const { controller, provider } = createController();
    provider.restoreSession.mockRejectedValue({
      message: 'private provider stack detail',
      secret: credential,
    });

    const renderer = await renderGate(controller);

    expect(renderer.root.findByProps({ testID: 'login-screen' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'auth-error' }).props.children).toBe(
      'We could not sign you in. Please try again.',
    );
    expect(JSON.stringify(renderer.toJSON())).not.toContain('private provider stack detail');
    expect(JSON.stringify(renderer.toJSON())).not.toContain(credential);
  });

  it('subscribes once and does not create a second LoginScreen subscription', async () => {
    const { controller } = createController();
    const subscribe = jest.spyOn(controller, 'subscribe');

    const renderer = await renderGate(controller);

    expect(renderer.root.findByProps({ testID: 'login-screen' })).toBeTruthy();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', async () => {
    const { controller } = createController();
    const originalSubscribe = controller.subscribe.bind(controller);
    const unsubscribe = jest.fn();
    jest.spyOn(controller, 'subscribe').mockImplementation(listener => {
      const cleanup = originalSubscribe(listener);
      return () => {
        unsubscribe();
        cleanup();
      };
    });
    const renderer = await renderGate(controller);

    await ReactTestRenderer.act(() => renderer.unmount());
    mountedRenderers.delete(renderer);

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('starts restoration through the controller, not directly through a provider', async () => {
    const { controller, provider } = createController();
    const initialize = jest.spyOn(controller, 'initialize');

    await renderGate(controller);

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(provider.restoreSession).toHaveBeenCalledTimes(1);
  });

  it('preserves LoginScreen form input while the gate displays OTP loading', async () => {
    const { controller, provider } = createController();
    let finishOtpRequest: () => void = () => undefined;
    provider.requestOtp.mockReturnValue(
      new Promise(resolve => {
        finishOtpRequest = resolve;
      }),
    );
    const renderer = await renderGate(controller);

    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'phone-input' }).props.onChangeText('+15550100');
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'request-otp-button' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'auth-gate-authenticating' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'phone-input' }).props.value).toBe('+15550100');

    await ReactTestRenderer.act(async () => {
      finishOtpRequest();
      await Promise.resolve();
    });
    expect(renderer.root.findByProps({ testID: 'otp-input' })).toBeTruthy();
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'otp-input' }).props.onChangeText('123456');
    });
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'verify-otp-button' }).props.onPress();
    });

    expect(provider.verifyOtp).toHaveBeenCalledWith('+15550100', '123456');
  });

  it('does not update the unmounted gate when async restoration finishes', async () => {
    const { controller, provider } = createController();
    let finishRestore: (value: ProviderCredential | null) => void = () => undefined;
    provider.restoreSession.mockReturnValue(
      new Promise(resolve => {
        finishRestore = resolve;
      }),
    );
    const renderer = await renderGate(controller);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await ReactTestRenderer.act(() => renderer.unmount());
    await ReactTestRenderer.act(async () => {
      finishRestore(null);
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
