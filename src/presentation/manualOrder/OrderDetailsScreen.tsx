import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CalendarService } from '../../application/calendar/CalendarService';
import type { ManualOrderService } from '../../application/manualOrder/ManualOrderService';
import type { CalendarEntry } from '../../domain/calendar/entities/CalendarEntry';
import type { ManualOrder } from '../../domain/manualOrder/entities/ManualOrder';

interface OrderDetailsScreenProps {
  readonly calendarService: CalendarService;
  readonly manualOrderService: ManualOrderService;
  readonly orderId: string;
}

interface OrderWithAppointment {
  readonly order: ManualOrder;
  readonly appointment: CalendarEntry;
}

type DetailsState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly value: OrderWithAppointment }
  | { readonly status: 'error' };

export function OrderDetailsScreen({
  calendarService,
  manualOrderService,
  orderId,
}: OrderDetailsScreenProps): React.JSX.Element {
  const [state, setState] = useState<DetailsState>({ status: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setState({ status: 'loading' });
    manualOrderService.get(orderId)
      .then(async order => ({
        order,
        appointment: await calendarService.getEntry(order.calendarEntryId),
      }))
      .then(value => {
        if (isCurrent) {
          setState({ status: 'loaded', value });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setState({ status: 'error' });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [calendarService, loadAttempt, manualOrderService, orderId]);

  return (
    <ScrollView contentContainerStyle={styles.screen} testID="manual-order-details">
      {state.status === 'loading' ? (
        <View style={styles.messageCard} testID="manual-order-details-loading">
          <ActivityIndicator color="#176B58" />
          <Text style={styles.message}>Loading order…</Text>
        </View>
      ) : null}
      {state.status === 'error' ? (
        <View style={styles.messageCard} testID="manual-order-details-error">
          <Text style={styles.messageTitle}>We couldn’t load this order</Text>
          <Pressable accessibilityRole="button" onPress={() => setLoadAttempt(attempt => attempt + 1)} style={styles.secondaryButton} testID="manual-order-details-retry">
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {state.status === 'loaded' ? (
        <View style={styles.detailCard} testID="manual-order-details-loaded">
          <Text style={styles.title}>{state.value.order.customerName}</Text>
          <DetailRow label="Service" value={state.value.order.serviceDescription} />
          <DetailRow label="Address" value={state.value.order.serviceAddress} />
          {state.value.order.customerPhone ? <DetailRow label="Phone" value={state.value.order.customerPhone} /> : null}
          {state.value.order.quotedPrice ? <DetailRow label="Price" value={formatPrice(state.value.order.quotedPrice.amountMinor, state.value.order.quotedPrice.currencyCode)} /> : null}
          {state.value.order.notes ? <DetailRow label="Notes" value={state.value.order.notes} /> : null}
          <DetailRow label="Date" testID="manual-order-details-date" value={new Date(state.value.appointment.startAt).toLocaleDateString()} />
          <DetailRow label="Start" testID="manual-order-details-start" value={new Date(state.value.appointment.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
          <DetailRow label="End" testID="manual-order-details-end" value={new Date(state.value.appointment.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function DetailRow({ label, testID, value }: { readonly label: string; readonly testID?: string; readonly value: string }): React.JSX.Element {
  return <Text style={styles.detailText}><Text style={styles.detailLabel}>{label}: </Text><Text testID={testID}>{value}</Text></Text>;
}

function formatPrice(amountMinor: number, currencyCode: string): string {
  const major = (amountMinor / 100).toFixed(2).replace(/\.00$/, '');
  return `${major} ${currencyCode}`;
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, gap: 12, padding: 20, backgroundColor: '#F4F7F6' },
  title: { color: '#17212b', fontSize: 24, fontWeight: '700' },
  detailCard: { gap: 10, padding: 16, borderRadius: 12, backgroundColor: '#F4F7F6' },
  detailText: { color: '#273733' },
  detailLabel: { color: '#52615e', fontWeight: '700' },
  messageCard: { alignItems: 'center', gap: 12, padding: 22, borderRadius: 16, backgroundColor: '#F4F7F6' },
  messageTitle: { color: '#17212b', fontSize: 17, fontWeight: '700' },
  message: { color: '#52615e' },
  secondaryButton: { alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#176B58', borderRadius: 12 },
  secondaryButtonText: { color: '#176B58', fontWeight: '700' },
});
