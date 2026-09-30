import { useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import type { AuthStateController } from './src/application/auth/AuthStateController';
import { createDevelopmentAuthController } from './src/development/auth/createDevelopmentAuthController';
import { AuthGate } from './src/presentation/auth/AuthGate';

interface AppProps {
  readonly authController?: AuthStateController;
}

function App({ authController }: AppProps) {
  const [controller] = useState(
    () => authController ?? createDevelopmentAuthController(),
  );

  return (
    <View style={styles.container} testID="qleanfeel-root">
      <StatusBar barStyle="dark-content" />
      <AuthGate controller={controller} />
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
