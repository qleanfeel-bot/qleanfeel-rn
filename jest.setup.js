/* global jest */

jest.mock('react-native-screens', () => {
  const { View } = require('react-native');
  return {
    enableScreens: jest.fn(),
    screensEnabled: jest.fn(() => true),
    Screen: View,
    InnerScreen: View,
    ScreenContext: require('react').createContext(null),
    ScreenContainer: View,
    ScreenStack: View,
    ScreenStackItem: View,
    ScreenStackHeaderConfig: View,
    ScreenStackHeaderBackButtonImage: View,
    ScreenStackHeaderCenterView: View,
    ScreenStackHeaderLeftView: View,
    ScreenStackHeaderRightView: View,
    ScreenStackHeaderSubview: View,
    ScreenStackHeaderSearchBarView: View,
    FullWindowOverlay: View,
    ScreenFooter: View,
    ScreenContentWrapper: View,
    SearchBar: View,
    compatibilityFlags: {},
    featureFlags: {},
    isSearchBarAvailableForCurrentPlatform: false,
    executeNativeBackPress: jest.fn(),
    enableFreeze: jest.fn(),
    freezeEnabled: jest.fn(() => false),
    useTransitionProgress: () => ({ progress: { value: 1 }, closing: { value: 0 }, goingForward: { value: 1 } }),
  };
});

jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  class PagerView extends React.Component {
    setPage(position) {
      this.props.onPageSelected?.({ nativeEvent: { position } });
    }
    setPageWithoutAnimation(position) {
      this.setPage(position);
    }
    setScrollEnabled() {}
    render() {
      return React.createElement(View, { style: this.props.style, testID: this.props.testID }, this.props.children);
    }
  }
  return { __esModule: true, default: PagerView };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const SafeAreaInsetsContext = React.createContext({ top: 0, right: 0, bottom: 0, left: 0 });
  const SafeAreaFrameContext = React.createContext({ x: 0, y: 0, width: 390, height: 844 });
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }) => React.createElement(
      SafeAreaInsetsContext.Provider,
      { value: insets },
      React.createElement(SafeAreaFrameContext.Provider, { value: frame }, children),
    ),
    SafeAreaView: View,
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    initialWindowMetrics: { insets, frame },
    useSafeAreaInsets: () => React.useContext(SafeAreaInsetsContext),
    useSafeAreaFrame: () => React.useContext(SafeAreaFrameContext),
  };
});
