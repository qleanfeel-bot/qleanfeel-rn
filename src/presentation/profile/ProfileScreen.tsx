import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { UserStatus } from '../../domain/auth/entities/User';
import type { Profile } from '../../domain/profile/entities/Profile';
import type { ProfileService } from '../../application/profile/ProfileService';

interface ProfileScreenProps {
  readonly profileService: ProfileService;
  readonly userId: string;
  readonly accountStatus: UserStatus;
  readonly onLogout: () => void;
}

type ProfileViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly profile: Profile }
  | { readonly status: 'missing' }
  | { readonly status: 'error' };

export function ProfileScreen({
  profileService,
  userId,
  accountStatus,
  onLogout,
}: ProfileScreenProps): React.JSX.Element {
  const [viewState, setViewState] = useState<ProfileViewState>({ status: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setViewState({ status: 'loading' });
    profileService
      .getProfile(userId)
      .then(profile => {
        if (isMounted) {
          setViewState(profile ? { status: 'loaded', profile } : { status: 'missing' });
        }
      })
      .catch(() => {
        if (isMounted) {
          setViewState({ status: 'error' });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [profileService, userId, loadAttempt]);

  const retry = () => setLoadAttempt(current => current + 1);

  return (
    <View style={styles.screen} testID="profile-screen">
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>Q</Text>
        </View>
        <Text style={styles.brandName}>Qleanfeel</Text>
      </View>
      <Text style={styles.title}>Profile</Text>

      {viewState.status === 'loading' ? (
        <View style={styles.messageCard} testID="profile-loading">
          <ActivityIndicator color="#176B58" />
          <Text style={styles.message}>Loading your profile…</Text>
        </View>
      ) : null}

      {viewState.status === 'missing' ? (
        <View style={styles.messageCard} testID="profile-missing">
          <Text style={styles.messageTitle}>Profile not found</Text>
          <Text style={styles.message}>Your profile information is not available yet.</Text>
        </View>
      ) : null}

      {viewState.status === 'error' ? (
        <View style={styles.messageCard} testID="profile-error">
          <Text style={styles.messageTitle}>We couldn’t load your profile</Text>
          <Text style={styles.message}>Please try again.</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {viewState.status === 'loaded' ? (
        <View style={styles.profileCard} testID="profile-loaded">
          <View style={styles.avatar} testID="profile-avatar">
            <Text style={styles.avatarText}>{getInitial(viewState.profile.displayName)}</Text>
          </View>
          <Text style={styles.displayName}>{viewState.profile.displayName}</Text>

          <View style={styles.details}>
            <ProfileDetail label="Phone" value={viewState.profile.phone} />
            <ProfileDetail label="Email" value={viewState.profile.email} />
          </View>

          <View style={styles.statusBadge}>
            <View style={accountStatus === 'active' ? styles.statusDot : styles.suspendedDot} />
            <Text style={styles.statusText}>
              {accountStatus === 'active' ? 'Account active' : 'Account suspended'}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            disabled
            onPress={() => undefined}
            style={styles.editButton}
            testID="edit-profile-button">
            <Text style={styles.editText}>Edit profile</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onLogout}
            style={styles.logoutButton}
            testID="logout-button">
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ProfileDetail({ label, value }: { readonly label: string; readonly value: string | null }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value ?? 'Not provided'}</Text>
    </View>
  );
}

function getInitial(displayName: string): string {
  return displayName.trim().charAt(0).toLocaleUpperCase() || '?';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: '#F4F7F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 34,
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
  },
  title: {
    marginBottom: 20,
    color: '#173C34',
    fontSize: 30,
    fontWeight: '700',
  },
  profileCard: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 26,
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
    marginBottom: 16,
    borderRadius: 38,
    backgroundColor: '#EAF3EF',
  },
  avatarText: {
    color: '#176B58',
    fontSize: 30,
    fontWeight: '700',
  },
  displayName: {
    color: '#1C342E',
    fontSize: 21,
    fontWeight: '700',
  },
  details: {
    alignSelf: 'stretch',
    gap: 14,
    marginTop: 24,
  },
  detail: {
    gap: 4,
  },
  detailLabel: {
    color: '#648078',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#263C35',
    fontSize: 15,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
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
  suspendedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#A96A42',
  },
  statusText: {
    color: '#347258',
    fontSize: 13,
    fontWeight: '600',
  },
  editButton: {
    minHeight: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#D5E1DC',
    borderRadius: 14,
    backgroundColor: '#F8FAF9',
    opacity: 0.65,
  },
  editText: {
    color: '#315B4E',
    fontSize: 15,
    fontWeight: '700',
  },
  messageCard: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E7EEEB',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  messageTitle: {
    color: '#173C34',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#667A74',
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#176B58',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  logoutButton: {
    minHeight: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
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
