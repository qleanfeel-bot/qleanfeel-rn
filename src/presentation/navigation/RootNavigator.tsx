import React from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import type { MaterialTopTabScreenProps } from '@react-navigation/material-top-tabs';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import type { CalendarService } from '../../application/calendar/CalendarService';
import type { CreateScheduledManualOrder } from '../../application/manualOrder/CreateScheduledManualOrder';
import type { ManualOrderService } from '../../application/manualOrder/ManualOrderService';
import type { ProfileService } from '../../application/profile/ProfileService';
import type { UserStatus } from '../../domain/auth/entities/User';
import { CalendarScreen } from '../calendar/CalendarScreen';
import { DaySummaryScreen } from '../calendar/DaySummaryScreen';
import { HomeScreen } from '../home/HomeScreen';
import { ManualOrderFormScreen, ManualOrdersScreen } from '../manualOrder/ManualOrdersScreen';
import { OrderDetailsScreen } from '../manualOrder/OrderDetailsScreen';
import { ProfileScreen } from '../profile/ProfileScreen';
import type { CalendarStackParamList, MainTabParamList, OrdersStackParamList } from './navigationTypes';

export interface RootNavigatorProps {
  readonly calendarService: CalendarService;
  readonly createScheduledManualOrder: CreateScheduledManualOrder;
  readonly manualOrderService: ManualOrderService;
  readonly profileService: ProfileService;
  readonly userId: string;
  readonly accountStatus: UserStatus;
  readonly onLogout: () => void;
}

const Tabs = createMaterialTopTabNavigator<MainTabParamList>();
const CalendarStack = createNativeStackNavigator<CalendarStackParamList>();
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();

export function RootNavigator(props: RootNavigatorProps): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <MainNavigator {...props} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function MainNavigator(props: RootNavigatorProps): React.JSX.Element {
  return (
    <Tabs.Navigator
      initialRouteName="Home"
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        lazy: true,
        tabBarActiveTintColor: '#176B58',
        tabBarInactiveTintColor: '#648078',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIndicatorStyle: styles.tabIndicator,
      }}>
      <Tabs.Screen
        name="Home"
        options={{ tabBarLabel: 'Home', tabBarButtonTestID: 'root-tab-home' }}>
        {screenProps => <HomeRoute {...props} {...screenProps} />}
      </Tabs.Screen>
      <Tabs.Screen
        name="Calendar"
        options={{ tabBarLabel: 'Calendar', tabBarButtonTestID: 'root-tab-calendar', swipeEnabled: false }}>
        {() => <CalendarStackNavigator {...props} />}
      </Tabs.Screen>
      <Tabs.Screen
        name="Orders"
        options={{ tabBarLabel: 'Orders', tabBarButtonTestID: 'root-tab-orders' }}>
        {() => <OrdersStackNavigator {...props} />}
      </Tabs.Screen>
      <Tabs.Screen
        name="Profile"
        options={{ tabBarLabel: 'Profile', tabBarButtonTestID: 'root-tab-profile' }}>
        {() => (
          <ProfileScreen
            accountStatus={props.accountStatus}
            onLogout={props.onLogout}
            profileService={props.profileService}
            userId={props.userId}
          />
        )}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

type HomeRouteProps = RootNavigatorProps & MaterialTopTabScreenProps<MainTabParamList, 'Home'>;

function HomeRoute({ navigation, ...props }: HomeRouteProps): React.JSX.Element {
  const isFocused = useIsFocused();
  return (
    <HomeScreen
      {...props}
      isFocused={isFocused}
      onOpenCalendar={() => navigation.navigate('Calendar', { screen: 'WeekView' })}
      onOpenOrder={orderId => navigation.navigate('Calendar', { screen: 'OrderDetails', params: { orderId } })}
      onOpenOrders={() => navigation.navigate('Orders', { screen: 'OrdersList' })}
    />
  );
}

function CalendarStackNavigator(props: RootNavigatorProps): React.JSX.Element {
  return (
    <CalendarStack.Navigator initialRouteName="WeekView">
      <CalendarStack.Screen
        name="WeekView"
        options={{ title: 'Calendar', headerShown: false }}
        listeners={({ navigation }) => ({
          focus: () => navigation.getParent()?.setOptions({ swipeEnabled: false }),
        })}>
        {screenProps => <CalendarWeekRoute {...props} {...screenProps} />}
      </CalendarStack.Screen>
      <CalendarStack.Screen
        name="DaySummary"
        options={({ route }) => ({ title: formatRouteDate(route.params.date) })}
        listeners={({ navigation }) => ({
          focus: () => navigation.getParent()?.setOptions({ swipeEnabled: false }),
        })}>
        {({ route, navigation }) => (
          <DaySummaryScreen
            calendarService={props.calendarService}
            date={route.params.date}
            manualOrderService={props.manualOrderService}
            onOpenOrder={orderId => navigation.navigate('OrderDetails', { orderId })}
          />
        )}
      </CalendarStack.Screen>
      <CalendarStack.Screen
        name="OrderDetails"
        options={{ title: 'Order Details' }}
        listeners={({ navigation }) => ({
          focus: () => navigation.getParent()?.setOptions({ swipeEnabled: false }),
        })}>
        {({ route }) => (
          <OrderDetailsScreen
            calendarService={props.calendarService}
            manualOrderService={props.manualOrderService}
            orderId={route.params.orderId}
          />
        )}
      </CalendarStack.Screen>
    </CalendarStack.Navigator>
  );
}

type CalendarWeekRouteProps = RootNavigatorProps & NativeStackScreenProps<CalendarStackParamList, 'WeekView'>;

function CalendarWeekRoute({ navigation, route, ...props }: CalendarWeekRouteProps): React.JSX.Element {
  const isFocused = useIsFocused();
  return (
    <CalendarScreen
      calendarService={props.calendarService}
      createScheduledManualOrder={props.createScheduledManualOrder}
      isFocused={isFocused}
      manualOrderService={props.manualOrderService}
      onOpenOrder={orderId => navigation.navigate('OrderDetails', { orderId })}
      onSelectDay={date => navigation.navigate('DaySummary', { date })}
      initialDate={route.params?.date}
    />
  );
}

function OrdersStackNavigator(props: RootNavigatorProps): React.JSX.Element {
  return (
    <OrdersStack.Navigator initialRouteName="OrdersList">
      <OrdersStack.Screen
        name="OrdersList"
        options={{ title: 'Orders' }}
        listeners={({ navigation }) => ({
          focus: () => navigation.getParent()?.setOptions({ swipeEnabled: true }),
        })}>
        {({ navigation }) => (
          <OrdersListRoute
            {...props}
            onAddOrder={() => navigation.navigate('AddOrder')}
            onOpenOrder={orderId => navigation.navigate('OrderDetails', { orderId })}
          />
        )}
      </OrdersStack.Screen>
      <OrdersStack.Screen
        name="AddOrder"
        options={{ title: 'Add Order' }}
        listeners={({ navigation }) => ({
          focus: () => navigation.getParent()?.setOptions({ swipeEnabled: false }),
        })}>
        {({ navigation }) => (
          <ManualOrderFormScreen
            createScheduledManualOrder={props.createScheduledManualOrder}
            onCancel={() => navigation.goBack()}
            onSaved={() => navigation.goBack()}
          />
        )}
      </OrdersStack.Screen>
      <OrdersStack.Screen
        name="OrderDetails"
        options={{ title: 'Order Details' }}
        listeners={({ navigation }) => ({
          focus: () => navigation.getParent()?.setOptions({ swipeEnabled: false }),
        })}>
        {({ route }) => (
          <OrderDetailsScreen
            calendarService={props.calendarService}
            manualOrderService={props.manualOrderService}
            orderId={route.params.orderId}
          />
        )}
      </OrdersStack.Screen>
    </OrdersStack.Navigator>
  );
}

interface OrdersListRouteProps extends RootNavigatorProps {
  readonly onAddOrder: () => void;
  readonly onOpenOrder: (orderId: string) => void;
}

function OrdersListRoute({
  calendarService,
  manualOrderService,
  onAddOrder,
  onOpenOrder,
}: OrdersListRouteProps): React.JSX.Element {
  return (
    <ManualOrdersScreen
      calendarService={calendarService}
      isFocused={useIsFocused()}
      manualOrderService={manualOrderService}
      onAddOrder={onAddOrder}
      onOpenOrder={onOpenOrder}
    />
  );
}

function formatRouteDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? 'Day Summary' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: '#FFFFFF', elevation: 8 },
  tabLabel: { fontSize: 11, fontWeight: '700', textTransform: 'none' },
  tabIndicator: { backgroundColor: '#176B58', height: 3 },
});
