import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import type { CalendarService } from '../../application/calendar/CalendarService';
import type { CreateScheduledManualOrder } from '../../application/manualOrder/CreateScheduledManualOrder';
import type { ManualOrderService } from '../../application/manualOrder/ManualOrderService';
import type { ProfileService } from '../../application/profile/ProfileService';
import type { UserStatus } from '../../domain/auth/entities/User';
import { RootNavigator } from '../navigation/RootNavigator';

interface AuthenticatedAppShellProps {
  readonly calendarService: CalendarService;
  readonly createScheduledManualOrder: CreateScheduledManualOrder;
  readonly manualOrderService: ManualOrderService;
  readonly profileService: ProfileService;
  readonly userId: string;
  readonly accountStatus: UserStatus;
  readonly onLogout: () => void;
}

export function AuthenticatedAppShell({
  calendarService,
  createScheduledManualOrder,
  manualOrderService,
  profileService,
  userId,
  accountStatus,
  onLogout,
}: AuthenticatedAppShellProps): React.JSX.Element {
  return (
    <View style={styles.shell} testID="authenticated-app-shell">
      <RootNavigator
        accountStatus={accountStatus}
        calendarService={calendarService}
        createScheduledManualOrder={createScheduledManualOrder}
        manualOrderService={manualOrderService}
        onLogout={onLogout}
        profileService={profileService}
        userId={userId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingTop: StatusBar.currentHeight ?? 0,
  },
});
