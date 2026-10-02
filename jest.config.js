module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((@)?react-native|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-pager-view|react-native-tab-view)/)',
  ],
};
