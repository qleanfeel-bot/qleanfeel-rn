import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AuthState } from '../../application/auth/AuthState';
import type { AuthStateController } from '../../application/auth/AuthStateController';
import { LoginScreen } from './LoginScreen';

interface AuthGateProps {
  readonly controller: AuthStateController;
}

export function AuthGate({ controller }: AuthGateProps): React.JSX.Element {
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
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>Q</Text>
            </View>
            <Text style={styles.brandName}>Qleanfeel</Text>
          </View>

          <View style={styles.welcome}>
            <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Your Qleanfeel space is ready.</Text>
          </View>

          <View style={styles.userCard} testID="authenticated-user-card">
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
            <Text style={styles.userName}>Qleanfeel User</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                {authState.user.status === 'active' ? 'Account active' : 'Account suspended'}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              controller.logout().catch(() => undefined);
            }}
            style={styles.logoutButton}
            testID="logout-button">
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: '#F4F7F6',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 48,
  },
  brandMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#176B58',
  },
  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  brandName: {
    color: '#173C34',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  welcome: {
    marginBottom: 26,
  },
  eyebrow: {
    marginBottom: 8,
    color: '#648078',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: '#173C34',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    color: '#667A74',
    fontSize: 15,
  },
  userCard: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 30,
    borderWidth: 1,
    borderColor: '#E7EEEB',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#193B33',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  avatar: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderRadius: 38,
    backgroundColor: '#EAF3EF',
  },
  avatarText: {
    fontSize: 34,
  },
  userName: {
    color: '#1C342E',
    fontSize: 20,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#EDF7F1',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2E936A',
  },
  statusText: {
    color: '#347258',
    fontSize: 13,
    fontWeight: '600',
  },
  logoutButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#D5E1DC',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  logoutText: {
    color: '#315B4E',
    fontSize: 15,
    fontWeight: '700',
  },
});
