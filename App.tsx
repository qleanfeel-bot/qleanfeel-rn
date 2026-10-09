import { useState } from 'react';
import { Button, Platform, StatusBar, StyleSheet, View } from 'react-native';
import type { AuthStateController } from './src/application/auth/AuthStateController';
import type { CalendarService } from './src/application/calendar/CalendarService';
import type { CreateScheduledManualOrder } from './src/application/manualOrder/CreateScheduledManualOrder';
import type { ManualOrderService } from './src/application/manualOrder/ManualOrderService';
import { createDevelopmentComposition } from './src/development/createDevelopmentComposition';
import { AuthGate } from './src/presentation/auth/AuthGate';
import type { ProfileService } from './src/application/profile/ProfileService';
import { KeychainSpikeScreen } from './src/development/keychain/KeychainSpikeScreen';

interface AppProps {
  readonly authController?: AuthStateController;
  readonly calendarService?: CalendarService;
  readonly createScheduledManualOrder?: CreateScheduledManualOrder;
  readonly manualOrderService?: ManualOrderService;
  readonly profileService?: ProfileService;
}

function App({
  authController,
  calendarService,
  createScheduledManualOrder,
  manualOrderService,
  profileService,
}: AppProps) {
  const [composition] = useState(() => createDevelopmentComposition());
  const [showKeychainSpike, setShowKeychainSpike] = useState(false);
  const controller = authController ?? composition.authController;
  const calendar = calendarService ?? composition.calendarService;
  const manualOrders = manualOrderService ?? composition.manualOrderService;
  const createScheduled =
    createScheduledManualOrder ?? composition.createScheduledManualOrder;
  const profiles = profileService ?? composition.profileService;

  return (
    <View style={styles.container} testID="qleanfeel-root">
      <StatusBar barStyle="dark-content" />
      {__DEV__ && Platform.OS === 'android' ? (
        <View style={styles.developmentTools}>
          <Button
            title={showKeychainSpike ? 'Return to app' : 'Open Keychain spike'}
            onPress={() => setShowKeychainSpike(current => !current)}
            testID="keychain-spike-toggle"
          />
        </View>
      ) : null}
      {showKeychainSpike && __DEV__ && Platform.OS === 'android' ? (
        <KeychainSpikeScreen />
      ) : (
        <AuthGate
          calendarService={calendar}
          createScheduledManualOrder={createScheduled}
          controller={controller}
          manualOrderService={manualOrders}
          profileService={profiles}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  developmentTools: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
});

export default App;
