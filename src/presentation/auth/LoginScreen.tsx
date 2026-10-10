import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AuthErrorCode } from '../../domain/auth/errors/AuthError';
import type { AuthState } from '../../application/auth/AuthState';
import type { AuthStateController } from '../../application/auth/AuthStateController';

interface LoginScreenProps {
  readonly controller: AuthStateController;
  /** Supplied by AuthGate to share its subscription and restoration lifecycle. */
  readonly authState?: AuthState;
  /** Keeps form state mounted while AuthGate displays a loading surface. */
  readonly isVisible?: boolean;
}

const errorMessages: Record<AuthErrorCode, string> = {
  InvalidCode: 'That code is not valid. Check it and try again.',
  CodeExpired: 'That code has expired. Request a new one.',
  TooManyAttempts: 'Too many attempts. Please try again later.',
  TooManyRequests: 'Too many requests. Please try again later.',
  NetworkError:
    'A network error occurred. Check your connection and try again.',
  AuthenticationRequired: 'Please sign in to continue.',
  SessionExpired: 'Your session has expired. Please sign in again.',
  SecureStorageError:
    'Secure sign-in storage is unavailable. Please try again.',
  LogoutIncomplete:
    'Sign-out could not clear all local credentials. Please try again.',
  AccountUnavailable: 'This account is not available.',
  UnknownAuthError: 'We could not sign you in. Please try again.',
};

export function LoginScreen({
  controller,
  authState: controlledAuthState,
  isVisible = true,
}: LoginScreenProps): React.JSX.Element {
  const [localAuthState, setLocalAuthState] = useState<AuthState>(
    controller.state,
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const authState = controlledAuthState ?? localAuthState;

  useEffect(() => {
    if (controlledAuthState !== undefined) {
      return;
    }

    const unsubscribe = controller.subscribe(setLocalAuthState);
    controller.initialize().catch(() => undefined);
    return unsubscribe;
  }, [controller, controlledAuthState]);

  const isBusy =
    authState.status === 'unknown' || authState.status === 'authenticating';
  const showCodeInput = otpRequested || authState.status === 'awaitingOtp';
  const errorCode =
    authState.status === 'error'
      ? authState.error.code
      : authState.status === 'sessionExpired'
      ? 'SessionExpired'
      : undefined;

  const requestOtp = async (): Promise<void> => {
    await controller.requestOtp(phoneNumber.trim());
    if (controller.state.status === 'awaitingOtp') {
      setOtpRequested(true);
    }
  };

  const verifyOtp = async (): Promise<void> => {
    await controller.verifyOtp(phoneNumber.trim(), code.trim());
  };

  if (authState.status === 'authenticated') {
    return (
      <View
        style={[styles.container, !isVisible && styles.hidden]}
        testID="login-authenticated"
      >
        <Text style={styles.title}>You’re signed in</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, !isVisible && styles.hidden]}
      testID="login-screen"
    >
      <Text style={styles.title}>Sign in to Qleanfeel</Text>
      <TextInput
        accessibilityLabel="Phone number"
        autoComplete="tel"
        keyboardType="phone-pad"
        onChangeText={setPhoneNumber}
        placeholder="Phone number"
        style={styles.input}
        testID="phone-input"
        value={phoneNumber}
        editable={!isBusy}
      />

      {showCodeInput ? (
        <TextInput
          accessibilityLabel="Verification code"
          autoComplete="one-time-code"
          keyboardType="number-pad"
          onChangeText={setCode}
          placeholder="Verification code"
          style={styles.input}
          testID="otp-input"
          value={code}
          editable={!isBusy}
        />
      ) : null}

      {isBusy ? (
        <View style={styles.progress} testID="auth-progress">
          <ActivityIndicator />
          <Text>
            {authState.status === 'unknown'
              ? 'Checking sign-in…'
              : 'Please wait…'}
          </Text>
        </View>
      ) : null}

      {errorCode ? (
        <Text
          accessibilityRole="alert"
          style={styles.error}
          testID="auth-error"
        >
          {errorMessages[errorCode]}
        </Text>
      ) : null}

      {!showCodeInput ? (
        <Pressable
          accessibilityRole="button"
          disabled={isBusy || phoneNumber.trim().length === 0}
          onPress={() => {
            requestOtp().catch(() => undefined);
          }}
          style={styles.button}
          testID="request-otp-button"
        >
          <Text style={styles.buttonText}>Request code</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={isBusy || code.trim().length === 0}
          onPress={() => {
            verifyOtp().catch(() => undefined);
          }}
          style={styles.button}
          testID="verify-otp-button"
        >
          <Text style={styles.buttonText}>Verify code</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  hidden: {
    display: 'none',
  },
  title: {
    marginBottom: 20,
    color: '#17212b',
    fontSize: 24,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#aab4bd',
    borderRadius: 6,
    color: '#17212b',
  },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderRadius: 6,
    backgroundColor: '#176b58',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 12,
  },
  error: {
    marginVertical: 8,
    color: '#b42318',
  },
});
