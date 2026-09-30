import React, { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import type { CalendarService } from '../../application/calendar/CalendarService';
import type { ProfileService } from '../../application/profile/ProfileService';
import type { UserStatus } from '../../domain/auth/entities/User';
import { CalendarScreen } from '../calendar/CalendarScreen';
import { ProfileScreen } from '../profile/ProfileScreen';

interface AuthenticatedAppShellProps {
  readonly calendarService: CalendarService;
  readonly profileService: ProfileService;
  readonly userId: string;
  readonly accountStatus: UserStatus;
  readonly onLogout: () => void;
}

type ActiveSurface = 'profile' | 'calendar';

export function AuthenticatedAppShell({
  calendarService,
  profileService,
  userId,
  accountStatus,
  onLogout,
}: AuthenticatedAppShellProps): React.JSX.Element {
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>('profile');

  return (
    <View style={styles.shell} testID="authenticated-app-shell">
      <View style={styles.surfaceControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeSurface === 'profile' }}
          onPress={() => setActiveSurface('profile')}
          style={styles.surfaceControl}
          testID="authenticated-shell-profile-button">
          <Text style={styles.surfaceControlText}>Profile</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeSurface === 'calendar' }}
          onPress={() => setActiveSurface('calendar')}
          style={styles.surfaceControl}
          testID="authenticated-shell-calendar-button">
          <Text style={styles.surfaceControlText}>Calendar</Text>
        </Pressable>
      </View>
      <View style={styles.surface}>
        {activeSurface === 'profile' ? (
          <ProfileScreen
            accountStatus={accountStatus}
            onLogout={onLogout}
            profileService={profileService}
            userId={userId}
          />
        ) : (
          <CalendarScreen calendarService={calendarService} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingTop: StatusBar.currentHeight ?? 0,
  },
  surfaceControls: {
    flexDirection: 'row',
  },
  surfaceControl: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  surfaceControlText: {
    color: '#17212b',
    fontWeight: '600',
  },
  surface: {
    flex: 1,
  },
});
