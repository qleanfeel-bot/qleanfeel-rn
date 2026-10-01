/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { createDevelopmentAuthController } from '../src/development/auth/createDevelopmentAuthController';

test('renders LoginScreen in the Qleanfeel root component', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(renderer!.root.findByProps({testID: 'qleanfeel-root'})).toBeTruthy();
  expect(renderer!.root.findByProps({testID: 'login-screen'})).toBeTruthy();
  expect(renderer!.root.findByProps({testID: 'phone-input'})).toBeTruthy();
  expect(renderer!.root.findByProps({children: 'Sign in to Qleanfeel'})).toBeTruthy();
});

test('supplies the injected AuthStateController to LoginScreen', async () => {
  const authController = createDevelopmentAuthController();
  const subscribe = jest.spyOn(authController, 'subscribe');
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App authController={authController} />);
  });

  expect(renderer!.root.findByProps({testID: 'login-screen'})).toBeTruthy();
  expect(subscribe).toHaveBeenCalledTimes(1);
});

test('renders using the development composition without provider or API infrastructure', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(renderer!.root.findByProps({testID: 'request-otp-button'})).toBeTruthy();
  expect(JSON.stringify(renderer!.toJSON())).not.toContain('development-preview-credential');
});

test('development composition exercises OTP and authenticated UI without exposing its credential', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'phone-input'}).props.onChangeText('+15550100');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'request-otp-button'}).props.onPress();
  });
  expect(renderer.root.findByProps({testID: 'otp-input'})).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'otp-input'}).props.onChangeText('000000');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'verify-otp-button'}).props.onPress();
  });

  expect(renderer.root.findByProps({testID: 'auth-gate-authenticated'})).toBeTruthy();
  expect(renderer.root.findByProps({testID: 'profile-loaded'})).toBeTruthy();
  expect(JSON.stringify(renderer.toJSON())).not.toContain('development-preview-credential');

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'authenticated-shell-calendar-button'}).props.onPress();
  });

  expect(renderer.root.findByProps({testID: 'calendar-screen'})).toBeTruthy();
  expect(renderer.root.findByProps({testID: 'calendar-entry-development-calendar-seed'}))
    .toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'authenticated-shell-profile-button'}).props.onPress();
  });

  expect(renderer.root.findByProps({testID: 'profile-screen'})).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'authenticated-shell-orders-button'}).props.onPress();
  });
  expect(renderer.root.findByProps({testID: 'manual-orders-empty'})).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'manual-orders-add-button'}).props.onPress();
  });
  for (const [testID, value] of [
    ['manual-order-customer-input', 'Ivan'],
    ['manual-order-service-input', 'Apartment cleaning'],
    ['manual-order-address-input', 'Nevsky 25'],
  ]) {
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({testID}).props.onChangeText(value);
    });
  }
  await ReactTestRenderer.act(async () => {
    await renderer.root.findByProps({testID: 'manual-order-save-button'}).props.onPress();
  });
  expect(renderer.root.findByProps({testID: 'manual-order-development-manual-order-1'})).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'manual-order-development-manual-order-1'}).props.onPress();
  });
  expect(renderer.root.findByProps({testID: 'manual-order-details-loaded'})).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'manual-order-details-back'}).props.onPress();
    renderer.root.findByProps({testID: 'authenticated-shell-profile-button'}).props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'logout-button'}).props.onPress();
  });
  expect(renderer.root.findByProps({testID: 'login-screen'})).toBeTruthy();
});
