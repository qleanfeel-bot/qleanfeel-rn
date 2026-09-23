import { StatusBar, StyleSheet, Text, View } from 'react-native';

function App() {
  return (
    <View style={styles.container} testID="qleanfeel-root">
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>Qleanfeel</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  title: {
    color: '#171717',
    fontSize: 28,
    fontWeight: '600',
  },
});

export default App;
