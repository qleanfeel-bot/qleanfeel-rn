import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { CalendarService } from '../../application/calendar/CalendarService';
import type { CreateScheduledManualOrder } from '../../application/manualOrder/CreateScheduledManualOrder';
import type { ManualOrderService } from '../../application/manualOrder/ManualOrderService';
import type { CreateManualOrderInput, ManualOrder, QuotedPrice } from '../../domain/manualOrder/entities/ManualOrder';
import type { CalendarEntry } from '../../domain/calendar/entities/CalendarEntry';

interface ManualOrdersScreenProps {
  readonly calendarService: CalendarService;
  readonly isFocused?: boolean;
  readonly manualOrderService: ManualOrderService;
  readonly onAddOrder: () => void;
  readonly onOpenOrder: (orderId: string) => void;
}

interface OrderWithAppointment {
  readonly order: ManualOrder;
  readonly appointment: CalendarEntry;
}

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly orders: OrderWithAppointment[] }
  | { readonly status: 'error' };

export function ManualOrdersScreen({
  calendarService,
  isFocused = true,
  manualOrderService,
  onAddOrder,
  onOpenOrder,
}: ManualOrdersScreenProps): React.JSX.Element {
  const [listState, setListState] = useState<ListState>({ status: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }
    let isCurrent = true;
    setListState({ status: 'loading' });
    manualOrderService.getOrders()
      .then(orders => Promise.all(orders.map(async order => ({
        order,
        appointment: await calendarService.getEntry(order.calendarEntryId),
      }))))
      .then(orders => {
        if (isCurrent) {
          setListState({ status: 'loaded', orders });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setListState({ status: 'error' });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [calendarService, isFocused, loadAttempt, manualOrderService]);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled" testID="manual-orders-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onAddOrder}
          style={styles.primaryButton}
          testID="manual-orders-add-button">
          <Text style={styles.primaryButtonText}>Add Order</Text>
        </Pressable>
      </View>

      {listState.status === 'loading' ? (
        <View style={styles.messageCard} testID="manual-orders-loading">
          <ActivityIndicator color="#176B58" />
          <Text style={styles.message}>Loading orders…</Text>
        </View>
      ) : null}

      {listState.status === 'error' ? (
        <View style={styles.messageCard} testID="manual-orders-error">
          <Text style={styles.messageTitle}>We couldn’t load your orders</Text>
          <Text style={styles.message}>Please try again.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLoadAttempt(current => current + 1)}
            style={styles.secondaryButton}
            testID="manual-orders-retry-button">
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {listState.status === 'loaded' && listState.orders.length === 0 ? (
        <View style={styles.messageCard} testID="manual-orders-empty">
          <Text style={styles.messageTitle}>No orders yet</Text>
        </View>
      ) : null}

      {listState.status === 'loaded' && listState.orders.length > 0 ? (
        <View style={styles.orders} testID="manual-orders-list">
          {listState.orders.map(({ order, appointment }) => (
            <Pressable
              accessibilityRole="button"
              key={order.id}
              onPress={() => onOpenOrder(order.id)}
              style={styles.orderCard}
              testID={`manual-order-${order.id}`}>
              <Text style={styles.orderTitle}>{order.customerName}</Text>
              <Text style={styles.orderText}>{order.serviceDescription}</Text>
              <Text style={styles.orderText}>{order.serviceAddress}</Text>
              <Text style={styles.orderMetadata}>{formatAppointment(appointment)}</Text>
              {order.quotedPrice ? (
                <Text style={styles.orderMetadata}>{formatPrice(order.quotedPrice)}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

interface ManualOrderFormProps {
  readonly initialDate?: string;
  readonly onCancel: () => void;
  readonly onSave: (input: Omit<CreateManualOrderInput, 'calendarEntryId'> & {
    readonly startAt: string;
    readonly endAt: string;
  }) => Promise<void>;
}

export interface ManualOrderFormScreenProps {
  readonly createScheduledManualOrder: CreateScheduledManualOrder;
  readonly initialDate?: string;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
}

export function ManualOrderFormScreen({
  createScheduledManualOrder,
  initialDate,
  onCancel,
  onSaved,
}: ManualOrderFormScreenProps): React.JSX.Element {
  const saveOrder = async (input: Omit<CreateManualOrderInput, 'calendarEntryId'> & {
    readonly startAt: string;
    readonly endAt: string;
  }): Promise<void> => {
    await createScheduledManualOrder.execute(input);
    onSaved();
  };
  return <ManualOrderForm initialDate={initialDate} onCancel={onCancel} onSave={saveOrder} />;
}

function ManualOrderForm({ initialDate, onCancel, onSave }: ManualOrderFormProps): React.JSX.Element {
  const defaults = createDefaultSchedule(initialDate);
  const [customerName, setCustomerName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [priceText, setPriceText] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(defaults.date);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const mutationInProgress = useRef(false);

  const save = async (): Promise<void> => {
    if (mutationInProgress.current) {
      return;
    }
    const normalizedCustomer = customerName.trim();
    const normalizedService = serviceDescription.trim();
    const normalizedAddress = serviceAddress.trim();
    if (!normalizedCustomer || !normalizedService || !normalizedAddress) {
      setError('Enter customer, service, and address.');
      return;
    }
    const startAt = localDateTimeToUtc(`${date.trim()}T${startTime.trim()}`);
    const endAt = localDateTimeToUtc(`${date.trim()}T${endTime.trim()}`);
    if (!startAt || !endAt) {
      setError('Enter a valid date and start and end times.');
      return;
    }
    if (Date.parse(startAt) >= Date.parse(endAt)) {
      setError('Start time must be before end time.');
      return;
    }
    const quotedPrice = parsePrice(priceText);
    if (quotedPrice === INVALID_PRICE) {
      setError('Enter a valid non-negative price and currency code.');
      return;
    }

    mutationInProgress.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        customerName: normalizedCustomer,
        serviceDescription: normalizedService,
        serviceAddress: normalizedAddress,
        customerPhone: customerPhone.trim() || null,
        quotedPrice,
        notes: notes.trim() || null,
        startAt,
        endAt,
      });
    } catch (saveError) {
      setError(errorCode(saveError) === 'ScheduledOrderCompensationFailed'
        ? 'Couldn’t finish saving the order. Check Calendar before retrying.'
        : 'Couldn’t save the order. Please try again.');
    } finally {
      mutationInProgress.current = false;
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled" testID="manual-order-form">
      <Text style={styles.title}>Add Order</Text>
      <FormField label="Customer" testID="manual-order-customer-input" value={customerName} onChangeText={setCustomerName} editable={!isSaving} />
      <FormField label="Service" testID="manual-order-service-input" value={serviceDescription} onChangeText={setServiceDescription} editable={!isSaving} />
      <FormField label="Address" testID="manual-order-address-input" value={serviceAddress} onChangeText={setServiceAddress} editable={!isSaving} />
      <FormField label="Phone (optional)" testID="manual-order-phone-input" value={customerPhone} onChangeText={setCustomerPhone} editable={!isSaving} keyboardType="phone-pad" />
      <FormField label="Price in RUB (optional)" testID="manual-order-price-input" value={priceText} onChangeText={setPriceText} editable={!isSaving} keyboardType="decimal-pad" />
      <FormField label="Date (local)" testID="manual-order-date-input" value={date} onChangeText={setDate} editable={!isSaving} placeholder="YYYY-MM-DD" />
      <FormField label="Start (local)" testID="manual-order-start-input" value={startTime} onChangeText={setStartTime} editable={!isSaving} placeholder="HH:mm" />
      <FormField label="End (local)" testID="manual-order-end-input" value={endTime} onChangeText={setEndTime} editable={!isSaving} placeholder="HH:mm" />
      <FormField label="Notes (optional)" testID="manual-order-notes-input" value={notes} onChangeText={setNotes} editable={!isSaving} multiline />
      {error ? <Text accessibilityRole="alert" style={styles.error} testID="manual-order-form-error">{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={save}
        style={[styles.primaryButton, isSaving && styles.disabledButton]}
        testID="manual-order-save-button">
        <Text style={styles.primaryButtonText}>{isSaving ? 'Saving…' : 'Save Order'}</Text>
      </Pressable>
      {isSaving ? <ActivityIndicator color="#176B58" testID="manual-order-saving" /> : null}
      <Pressable accessibilityRole="button" disabled={isSaving} onPress={onCancel} style={styles.secondaryButton} testID="manual-order-cancel-button">
        <Text style={styles.secondaryButtonText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

interface FormFieldProps {
  readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  readonly editable: boolean;
  readonly keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'phone-pad';
  readonly label: string;
  readonly multiline?: boolean;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly testID: string;
  readonly value: string;
}

function FormField({
  autoCapitalize,
  editable,
  keyboardType,
  label,
  multiline,
  onChangeText,
  placeholder,
  testID,
  value,
}: FormFieldProps): React.JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={[styles.input, multiline && styles.multilineInput]}
        testID={testID}
        value={value}
      />
    </View>
  );
}

function createDefaultSchedule(initialDate?: string, now = new Date()): { date: string; startTime: string; endTime: string } {
  const start = new Date(now.getTime());
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  if (start.getHours() < 8 || start.getHours() >= 22) {
    start.setDate(start.getDate() + 1);
    start.setHours(9, 0, 0, 0);
  }
  const end = new Date(start.getTime());
  end.setHours(end.getHours() + 2);
  return {
    date: initialDate ?? formatDateInput(start),
    startTime: formatTimeInput(start),
    endTime: formatTimeInput(end),
  };
}

function formatDateInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDateTimeToUtc(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, 0, 0);
  if (
    Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 ||
    date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute
  ) {
    return null;
  }
  return date.toISOString();
}

const INVALID_PRICE = Symbol('invalid price');

function parsePrice(value: string): QuotedPrice | null | typeof INVALID_PRICE {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return null;
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return INVALID_PRICE;
  }
  const [whole, fraction = ''] = normalized.split('.');
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    return INVALID_PRICE;
  }
  return { amountMinor, currencyCode: 'RUB' };
}

function formatPrice(price: QuotedPrice): string {
  const major = (price.amountMinor / 100).toFixed(2).replace(/\.00$/, '');
  return `${major} ${price.currencyCode}`;
}

function errorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { readonly code: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

function formatAppointment(entry: CalendarEntry): string {
  const date = new Date(entry.startAt).toLocaleDateString();
  const start = new Date(entry.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const end = new Date(entry.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${start}–${end}`;
}

const styles = StyleSheet.create({
  screen: { padding: 20, gap: 12 },
  header: { gap: 12 },
  title: { color: '#17212b', fontSize: 24, fontWeight: '700' },
  primaryButton: { alignItems: 'center', backgroundColor: '#176B58', borderRadius: 8, padding: 13 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryButton: { alignItems: 'center', borderColor: '#176B58', borderRadius: 8, borderWidth: 1, padding: 12 },
  secondaryButtonText: { color: '#176B58', fontWeight: '600' },
  disabledButton: { opacity: 0.6 },
  messageCard: { alignItems: 'center', backgroundColor: '#F4F7F6', borderRadius: 12, gap: 10, padding: 20 },
  messageTitle: { color: '#17212b', fontSize: 17, fontWeight: '700' },
  message: { color: '#52615e' },
  orders: { gap: 10 },
  orderCard: { backgroundColor: '#F4F7F6', borderRadius: 12, gap: 5, padding: 16 },
  orderTitle: { color: '#17212b', fontSize: 18, fontWeight: '700' },
  orderText: { color: '#273733' },
  orderMetadata: { color: '#52615e', fontSize: 13 },
  field: { gap: 5 },
  fieldLabel: { color: '#273733', fontWeight: '600' },
  input: { borderColor: '#AAB8B4', borderRadius: 8, borderWidth: 1, color: '#17212b', padding: 11 },
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: '#B3261E' },
  detailCard: { backgroundColor: '#F4F7F6', borderRadius: 12, gap: 10, padding: 16 },
  detailText: { color: '#273733' },
  detailLabel: { fontWeight: '700' },
});
