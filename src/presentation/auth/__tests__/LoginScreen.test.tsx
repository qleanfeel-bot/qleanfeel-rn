import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { User } from '../../../domain/auth/entities/User';
import type { ProviderCredential } from '../../../application/auth/ProviderCredential';
import type { AuthApi } from '../../../application/auth/ports/AuthApi';
import type { AuthProviderAdapter } from '../../../application/auth/ports/AuthProviderAdapter';
import { AuthStateController } from '../../../application/auth/AuthStateController';
import { LoginScreen } from '../LoginScreen';

const user: User = {
  id: 'internal-user-id',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const secretCredential = 'opaque-secret-credential' as ProviderCredential;

function createController() {
  const provider: jest.Mocked<AuthProviderAdapter> = {
    requestOtp: jest.fn().mockResolvedValue(undefined),
    verifyOtp: jest.fn().mockResolvedValue(secretCredential),
    restoreSession: jest.fn().mockResolvedValue(null),
    signOut: jest.fn().mockResolvedValue(undefined),
  };
  const api: jest.Mocked<AuthApi> = {
    bootstrap: jest.fn().mockResolvedValue(user),
    getCurrentUser: jest.fn().mockResolvedValue(user),
  };

  return { controller: new AuthStateController(provider, api), provider, api };
}

async function renderLogin(controller: AuthStateController) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<LoginScreen controller={controller} />);
  });
  return renderer;
}

function input(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return renderer.root.findByProps({ testID });
}

function button(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return renderer.root.findByProps({ testID });
}

describe('LoginScreen', () => {
  it('renders a phone number input', async () => {
    const { controller } = createController();
    const renderer = await renderLogin(controller);

    expect(input(renderer, 'phone-input').props.accessibilityLabel).toBe('Phone number');
  });

  it('requests an OTP and then displays the code input', async () => {
    const { controller, provider } = createController();
    const renderer = await renderLogin(controller);
    await ReactTestRenderer.act(async () => {
      input(renderer, 'phone-input').props.onChangeText('+1 555 0100');
    });
    await ReactTestRenderer.act(async () => {
      button(renderer, 'request-otp-button').props.onPress();
    });

    expect(provider.requestOtp).toHaveBeenCalledWith('+1 555 0100');
    expect(input(renderer, 'otp-input')).toBeTruthy();
  });

  it('verifies the entered OTP through the controller', async () => {
    const { controller, provider, api } = createController();
    const renderer = await renderLogin(controller);
    await ReactTestRenderer.act(async () => {
      input(renderer, 'phone-input').props.onChangeText('+15550100');
    });
    await ReactTestRenderer.act(async () => {
      button(renderer, 'request-otp-button').props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      input(renderer, 'otp-input').props.onChangeText('123456');
    });
    await ReactTestRenderer.act(async () => {
      button(renderer, 'verify-otp-button').props.onPress();
    });

    expect(provider.verifyOtp).toHaveBeenCalledWith('+15550100', '123456');
    expect(api.bootstrap).toHaveBeenCalledWith(secretCredential);
    expect(renderer.root.findByProps({ testID: 'login-authenticated' })).toBeTruthy();
  });

  it('shows progress and disables actions while authenticating', async () => {
    const { controller, provider } = createController();
    let releaseOtpRequest: () => void = () => {};
    provider.requestOtp.mockReturnValue(
      new Promise<void>(resolve => {
        releaseOtpRequest = resolve;
      }),
    );
    const renderer = await renderLogin(controller);
    await ReactTestRenderer.act(async () => {
      input(renderer, 'phone-input').props.onChangeText('+15550100');
    });

    let request!: Promise<void>;
    await ReactTestRenderer.act(async () => {
      request = button(renderer, 'request-otp-button').props.onPress();
    });
    expect(renderer.root.findByProps({ testID: 'auth-progress' })).toBeTruthy();
    expect(button(renderer, 'request-otp-button').props.disabled).toBe(true);

    await ReactTestRenderer.act(async () => {
      releaseOtpRequest();
      await request;
    });
  });

  it('renders a safe message for authentication errors, not the raw error message', async () => {
    const { controller, provider } = createController();
    provider.requestOtp.mockRejectedValue({ code: 'TooManyRequests', message: secretCredential });
    const renderer = await renderLogin(controller);
    await ReactTestRenderer.act(async () => {
      input(renderer, 'phone-input').props.onChangeText('+15550100');
    });
    await ReactTestRenderer.act(async () => {
      button(renderer, 'request-otp-button').props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'auth-error' }).props.children).toBe(
      'Too many requests. Please try again later.',
    );
    expect(JSON.stringify(renderer.toJSON())).not.toContain(secretCredential);
  });

  it('allows requesting a code again after a request error', async () => {
    const { controller, provider } = createController();
    provider.requestOtp
      .mockRejectedValueOnce({ code: 'NetworkError' })
      .mockResolvedValueOnce(undefined);
    const renderer = await renderLogin(controller);
    await ReactTestRenderer.act(async () => {
      input(renderer, 'phone-input').props.onChangeText('+15550100');
    });
    await ReactTestRenderer.act(async () => {
      button(renderer, 'request-otp-button').props.onPress();
    });
    expect(renderer.root.findByProps({ testID: 'auth-error' })).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      button(renderer, 'request-otp-button').props.onPress();
    });

    expect(provider.requestOtp).toHaveBeenCalledTimes(2);
    expect(input(renderer, 'otp-input')).toBeTruthy();
  });

  it('shows a safe InvalidCode message and allows verification retry', async () => {
    const { controller, provider } = createController();
    provider.verifyOtp
      .mockRejectedValueOnce({ code: 'InvalidCode', message: 'private invalid-code details' })
      .mockResolvedValueOnce(secretCredential);
    const renderer = await renderLogin(controller);
    await ReactTestRenderer.act(async () => {
      input(renderer, 'phone-input').props.onChangeText('+15550100');
    });
    await ReactTestRenderer.act(async () => {
      button(renderer, 'request-otp-button').props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      input(renderer, 'otp-input').props.onChangeText('bad-code');
    });
    await ReactTestRenderer.act(async () => {
      button(renderer, 'verify-otp-button').props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'auth-error' }).props.children).toBe(
      'That code is not valid. Check it and try again.',
    );
    expect(renderer.root.findByProps({ testID: 'otp-input' }).props.value).toBe('bad-code');
    expect(button(renderer, 'verify-otp-button').props.disabled).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).not.toContain('private invalid-code details');

    await ReactTestRenderer.act(async () => {
      input(renderer, 'otp-input').props.onChangeText('123456');
    });
    await ReactTestRenderer.act(async () => {
      button(renderer, 'verify-otp-button').props.onPress();
    });

    expect(provider.verifyOtp).toHaveBeenNthCalledWith(1, '+15550100', 'bad-code');
    expect(provider.verifyOtp).toHaveBeenNthCalledWith(2, '+15550100', '123456');
    expect(renderer.root.findByProps({ testID: 'login-authenticated' })).toBeTruthy();
  });

  it('subscribes to AuthStateController on mount', async () => {
    const { controller } = createController();
    const subscribe = jest.spyOn(controller, 'subscribe');

    await renderLogin(controller);

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(expect.any(Function));
  });

  it('unsubscribes from AuthStateController when unmounted', async () => {
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
    const renderer = await renderLogin(controller);

    await ReactTestRenderer.act(() => renderer.unmount());

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not render provider credentials or tokens', async () => {
    const { controller } = createController();
    const renderer = await renderLogin(controller);
    await ReactTestRenderer.act(async () => {
      input(renderer, 'phone-input').props.onChangeText('+15550100');
    });
    await ReactTestRenderer.act(async () => {
      button(renderer, 'request-otp-button').props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      input(renderer, 'otp-input').props.onChangeText('123456');
    });
    await ReactTestRenderer.act(async () => {
      button(renderer, 'verify-otp-button').props.onPress();
    });

    const renderedOutput = JSON.stringify(renderer.toJSON());
    expect(renderedOutput).not.toContain(secretCredential);
    expect(renderedOutput).not.toContain('accessToken');
    expect(renderedOutput).not.toContain('refreshToken');
  });
});
