import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { AuthState } from '../../application/auth/AuthState';
import type { AuthStateController } from '../../application/auth/AuthStateController';
import type { CalendarService } from '../../application/calendar/CalendarService';
import type { ProfileService } from '../../application/profile/ProfileService';
import { LoginScreen } from './LoginScreen';
import { AuthenticatedAppShell } from './AuthenticatedAppShell';

interface AuthGateProps {
  readonly calendarService: CalendarService;
  readonly controller: AuthStateController;
  readonly profileService: ProfileService;
}

export function AuthGate({
  calendarService,
  controller,
  profileService,
}: AuthGateProps): React.JSX.Element {
  const [authState, setAuthState] = useState<AuthState>(controller.state);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = controller.subscribe(state => {
      if (isMounted) {
        setAuthState(state);
      }
    });

    controller.initialize().catch(() => undefined);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [controller]);

  const isLoading = authState.status === 'unknown' || authState.status === 'authenticating';
  const isAuthenticated = authState.status === 'authenticated';
  const isLoginVisible = !isLoading && !isAuthenticated;

  return (
    <View style={styles.gate} testID="auth-gate">
      <LoginScreen
        controller={controller}
        authState={authState}
        isVisible={isLoginVisible}
      />
      {isLoading ? (
        <LoadingSurface
          testID={authState.status === 'unknown' ? 'auth-gate-restoring' : 'auth-gate-authenticating'}
          message={authState.status === 'unknown' ? 'Restoring your session…' : 'Please wait…'}
        />
      ) : null}
      {isAuthenticated ? (
        <View style={styles.authenticated} testID="auth-gate-authenticated">
          <AuthenticatedAppShell
            calendarService={calendarService}
            onLogout={() => {
              controller.logout().catch(() => undefined);
            }}
            profileService={profileService}
            userId={authState.user.id}
            accountStatus={authState.user.status}
          />
        </View>
      ) : null}
    </View>
  );
}

interface LoadingSurfaceProps {
  readonly testID: string;
  readonly message: string;
}

function LoadingSurface({ testID, message }: LoadingSurfaceProps): React.JSX.Element {
  return (
    <View style={styles.loading} testID={testID}>
      <ActivityIndicator />
      <Text style={styles.loadingMessage}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingMessage: {
    color: '#17212b',
  },
  authenticated: {
    flex: 1,
  },
});
