import type { NavigatorScreenParams } from '@react-navigation/native';

export type CalendarStackParamList = {
  WeekView: { readonly date?: string } | undefined;
  DaySummary: { readonly date: string };
  OrderDetails: { readonly orderId: string };
};

export type OrdersStackParamList = {
  OrdersList: undefined;
  AddOrder: undefined;
  OrderDetails: { readonly orderId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Calendar: NavigatorScreenParams<CalendarStackParamList> | undefined;
  Orders: NavigatorScreenParams<OrdersStackParamList> | undefined;
  Profile: undefined;
};
