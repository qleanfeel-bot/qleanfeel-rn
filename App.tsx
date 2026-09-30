import { useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import type { AuthStateController } from './src/application/auth/AuthStateController';
import { createDevelopmentAuthController } from './src/development/auth/createDevelopmentAuthController';
import { createDevelopmentProfileService } from './src/development/profile/createDevelopmentProfileService';
import { AuthGate } from './src/presentation/auth/AuthGate';
import type { ProfileService } from './src/application/profile/ProfileService';

interface AppProps {
  readonly authController?: AuthStateController;
  readonly profileService?: ProfileService;
}

function App({ authController, profileService }: AppProps) {
  const [controller] = useState(() => authController ?? createDevelopmentAuthController());
  const [profiles] = useState(() => profileService ?? createDevelopmentProfileService());

  return (
    <View style={styles.container} testID="qleanfeel-root">
      <StatusBar barStyle="dark-content" />
      <AuthGate controller={controller} profileService={profiles} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

export default App;
