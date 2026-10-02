import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CalendarService } from '../../application/calendar/CalendarService';
import type { ManualOrderService } from '../../application/manualOrder/ManualOrderService';
import type { ProfileService } from '../../application/profile/ProfileService';
import type { CalendarEntry } from '../../domain/calendar/entities/CalendarEntry';
import type { ManualOrder } from '../../domain/manualOrder/entities/ManualOrder';
import { localDayRange } from '../calendar/calendarDateUtils';

interface HomeScreenProps {
  readonly calendarService: CalendarService;
  readonly manualOrderService: ManualOrderService;
  readonly profileService: ProfileService;
  readonly userId: string;
  readonly isFocused?: boolean;
  readonly onOpenCalendar: () => void;
  readonly onOpenOrders: () => void;
  readonly onOpenOrder: (orderId: string) => void;
}

interface TodayOrder {
  readonly calendarEntry: CalendarEntry;
  readonly order: ManualOrder;
}

type HomeState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly displayName: string | null; readonly orders: TodayOrder[] }
  | { readonly status: 'error' };

export function HomeScreen({
  calendarService,
  manualOrderService,
  profileService,
  userId,
  isFocused = true,
  onOpenCalendar,
  onOpenOrders,
  onOpenOrder,
}: HomeScreenProps): React.JSX.Element {
  const [state, setState] = useState<HomeState>({ status: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }
    let isCurrent = true;
    setState({ status: 'loading' });
    const range = localDayRange(new Date());
    Promise.all([
      calendarService.getEntries(range.from, range.to),
      manualOrderService.getOrders(),
      profileService.getProfile(userId),
    ]).then(([entries, orders, profile]) => {
      if (!isCurrent) {
        return;
      }
      const ordersByEntryId = new Map(orders.map(order => [order.calendarEntryId, order]));
      const todayOrders = entries
        .filter(entry => entry.type === 'external_order' && entry.status === 'scheduled')
        .flatMap(calendarEntry => {
          const order = ordersByEntryId.get(calendarEntry.id);
          return order ? [{ calendarEntry, order }] : [];
        })
        .sort((left, right) => Date.parse(left.calendarEntry.startAt) - Date.parse(right.calendarEntry.startAt));
      setState({ status: 'loaded', displayName: profile?.displayName ?? null, orders: todayOrders });
    }).catch(() => {
      if (isCurrent) {
        setState({ status: 'error' });
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [calendarService, isFocused, loadAttempt, manualOrderService, profileService, userId]);

  const greeting = state.status === 'loaded' && state.displayName
    ? `Hello, ${state.displayName}`
    : 'Hello';

  return (
    <ScrollView contentContainerStyle={styles.screen} testID="home-screen">
      <Text style={styles.eyebrow}>Qleanfeel</Text>
      <Text style={styles.greeting} testID="home-greeting">{greeting}</Text>
      <Text style={styles.date} testID="home-today-date">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </Text>
      <Text style={styles.sectionTitle}>Today’s work</Text>

      {state.status === 'loading' ? (
        <View style={styles.messageCard} testID="home-loading">
          <ActivityIndicator color="#176B58" />
          <Text style={styles.message}>Loading today’s schedule…</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.messageCard} testID="home-error">
          <Text style={styles.messageTitle}>We couldn’t load today’s schedule</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLoadAttempt(attempt => attempt + 1)}
            style={styles.secondaryButton}
            testID="home-retry-button">
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'loaded' && state.orders.length === 0 ? (
        <View style={styles.messageCard} testID="home-empty">
          <Text style={styles.messageTitle}>No orders scheduled for today</Text>
          <Text style={styles.message}>Your day is clear.</Text>
        </View>
      ) : null}

      {state.status === 'loaded' && state.orders.length > 0 ? (
        <View style={styles.orderList} testID="home-today-orders">
          {state.orders.map(({ calendarEntry, order }) => (
            <Pressable
              accessibilityRole="button"
              key={order.id}
              onPress={() => onOpenOrder(order.id)}
              style={styles.orderCard}
              testID={`home-order-${order.id}`}>
              <Text style={styles.orderTime}>
                {new Date(calendarEntry.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {new Date(calendarEntry.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.orderName}>{order.customerName}</Text>
              <Text style={styles.orderDescription}>{order.serviceDescription}</Text>
              <Text style={styles.orderAddress}>{order.serviceAddress}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.shortcuts}>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenCalendar}
          style={styles.primaryButton}
          testID="home-open-calendar">
          <Text style={styles.primaryButtonText}>Open Calendar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenOrders}
          style={styles.secondaryButton}
          testID="home-open-orders">
          <Text style={styles.secondaryButtonText}>Open Orders</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, gap: 12, padding: 22, backgroundColor: '#F4F7F6' },
  eyebrow: { color: '#648078', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  greeting: { color: '#173C34', fontSize: 28, fontWeight: '700' },
  date: { color: '#648078', fontSize: 16, textTransform: 'capitalize' },
  sectionTitle: { marginTop: 14, color: '#173C34', fontSize: 20, fontWeight: '700' },
  messageCard: { alignItems: 'center', gap: 12, padding: 22, borderWidth: 1, borderColor: '#E7EEEB', borderRadius: 18, backgroundColor: '#FFFFFF' },
  messageTitle: { color: '#1C342E', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  message: { color: '#667A74', fontSize: 14, textAlign: 'center' },
  orderList: { gap: 10 },
  orderCard: { gap: 5, padding: 16, borderWidth: 1, borderColor: '#E7EEEB', borderRadius: 16, backgroundColor: '#FFFFFF' },
  orderTime: { color: '#176B58', fontWeight: '700' },
  orderName: { color: '#1C342E', fontSize: 17, fontWeight: '700' },
  orderDescription: { color: '#354C44' },
  orderAddress: { color: '#667A74', fontSize: 13 },
  shortcuts: { gap: 10, marginTop: 12 },
  primaryButton: { alignItems: 'center', padding: 13, borderRadius: 12, backgroundColor: '#176B58' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryButton: { alignItems: 'center', padding: 13, borderWidth: 1, borderColor: '#176B58', borderRadius: 12, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#176B58', fontWeight: '700' },
});
