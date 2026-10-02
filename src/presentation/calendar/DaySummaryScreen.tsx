import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CalendarService } from '../../application/calendar/CalendarService';
import type { ManualOrderService } from '../../application/manualOrder/ManualOrderService';
import type { CalendarEntry } from '../../domain/calendar/entities/CalendarEntry';
import type { ManualOrder } from '../../domain/manualOrder/entities/ManualOrder';
import { localDayRange, parseLocalDateKey } from './calendarDateUtils';

interface DaySummaryScreenProps {
  readonly calendarService: CalendarService;
  readonly manualOrderService: ManualOrderService;
  readonly date: string;
  readonly onOpenOrder: (orderId: string) => void;
}

interface DayRecord {
  readonly entry: CalendarEntry;
  readonly order: ManualOrder | null;
}

type DayState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly records: DayRecord[] }
  | { readonly status: 'error' };

export function DaySummaryScreen({
  calendarService,
  manualOrderService,
  date,
  onOpenOrder,
}: DaySummaryScreenProps): React.JSX.Element {
  const [state, setState] = useState<DayState>({ status: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    const localDate = parseLocalDateKey(date);
    if (!localDate) {
      setState({ status: 'error' });
      return () => {
        isCurrent = false;
      };
    }

    setState({ status: 'loading' });
    const range = localDayRange(localDate);
    Promise.all([
      calendarService.getEntries(range.from, range.to),
      manualOrderService.getOrders(),
    ]).then(([entries, orders]) => {
      if (!isCurrent) {
        return;
      }
      const ordersByEntryId = new Map(orders.map(order => [order.calendarEntryId, order]));
      const records = entries
        .map(entry => ({ entry, order: ordersByEntryId.get(entry.id) ?? null }))
        .sort((left, right) => Date.parse(left.entry.startAt) - Date.parse(right.entry.startAt));
      setState({ status: 'loaded', records });
    }).catch(() => {
      if (isCurrent) {
        setState({ status: 'error' });
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [calendarService, date, loadAttempt, manualOrderService]);

  const localDate = parseLocalDateKey(date);

  return (
    <ScrollView contentContainerStyle={styles.screen} testID="day-summary-screen">
      <Text style={styles.date} testID="day-summary-date">
        {localDate?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) ?? date}
      </Text>
      {state.status === 'loading' ? (
        <View style={styles.messageCard} testID="day-summary-loading">
          <ActivityIndicator color="#176B58" />
          <Text style={styles.message}>Loading this day…</Text>
        </View>
      ) : null}
      {state.status === 'error' ? (
        <View style={styles.messageCard} testID="day-summary-error">
          <Text style={styles.messageTitle}>We couldn’t load this day</Text>
          <Pressable accessibilityRole="button" onPress={() => setLoadAttempt(attempt => attempt + 1)} style={styles.secondaryButton} testID="day-summary-retry">
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {state.status === 'loaded' && state.records.length === 0 ? (
        <View style={styles.messageCard} testID="day-summary-empty">
          <Text style={styles.messageTitle}>Nothing scheduled for this day</Text>
        </View>
      ) : null}
      {state.status === 'loaded' && state.records.length > 0 ? (
        <View style={styles.records} testID="day-summary-records">
          {state.records.map(({ entry, order }) => {
            const content = (
              <>
                <Text style={styles.time}>
                  {new Date(entry.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(entry.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.title}>{order?.customerName ?? entry.title}</Text>
                <Text style={styles.detail}>{order?.serviceDescription ?? entry.type}</Text>
                {order ? <Text style={styles.detail}>{order.serviceAddress}</Text> : null}
              </>
            );

            return order ? (
              <Pressable
                accessibilityRole="button"
                key={entry.id}
                onPress={() => onOpenOrder(order.id)}
                style={styles.record}
                testID={`day-summary-order-${order.id}`}>
                {content}
              </Pressable>
            ) : (
              <View key={entry.id} style={styles.record} testID={`day-summary-entry-${entry.id}`}>
                {content}
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, gap: 14, padding: 20, backgroundColor: '#F4F7F6' },
  date: { color: '#173C34', fontSize: 24, fontWeight: '700', textTransform: 'capitalize' },
  records: { gap: 10 },
  record: { gap: 5, padding: 16, borderWidth: 1, borderColor: '#E7EEEB', borderRadius: 16, backgroundColor: '#FFFFFF' },
  time: { color: '#176B58', fontWeight: '700' },
  title: { color: '#1C342E', fontSize: 17, fontWeight: '700' },
  detail: { color: '#667A74', fontSize: 14 },
  messageCard: { alignItems: 'center', gap: 12, padding: 22, borderWidth: 1, borderColor: '#E7EEEB', borderRadius: 18, backgroundColor: '#FFFFFF' },
  messageTitle: { color: '#1C342E', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  message: { color: '#667A74', fontSize: 14, textAlign: 'center' },
  secondaryButton: { alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#176B58', borderRadius: 12 },
  secondaryButtonText: { color: '#176B58', fontWeight: '700' },
});
