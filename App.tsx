import { useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import type { AuthStateController } from './src/application/auth/AuthStateController';
import { createDevelopmentComposition } from './src/development/createDevelopmentComposition';
import { AuthGate } from './src/presentation/auth/AuthGate';
import type { ProfileService } from './src/application/profile/ProfileService';

interface AppProps {
  readonly authController?: AuthStateController;
  readonly profileService?: ProfileService;
}

function App({ authController, profileService }: AppProps) {
  const [composition] = useState(() => createDevelopmentComposition());
  const controller = authController ?? composition.authController;
  const profiles = profileService ?? composition.profileService;

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
