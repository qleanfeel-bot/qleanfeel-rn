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
import PagerView from 'react-native-pager-view';
import type { CalendarService } from '../../application/calendar/CalendarService';
import type { CreateScheduledManualOrder } from '../../application/manualOrder/CreateScheduledManualOrder';
import type { ManualOrderService } from '../../application/manualOrder/ManualOrderService';
import {
  CALENDAR_ENTRY_TYPES,
  type CalendarEntry,
  type CalendarEntryStatus,
  type CalendarEntryType,
} from '../../domain/calendar/entities/CalendarEntry';
import type { ManualOrder } from '../../domain/manualOrder/entities/ManualOrder';
import { MonthSelector } from './MonthSelector';
import {
  addCalendarDays,
  formatCalendarWeek,
  getCalendarWeekDates,
  localWeekRange,
  parseLocalDateKey,
  startOfCalendarWeek,
  toLocalDateKey,
} from './calendarDateUtils';

interface CalendarScreenProps {
  readonly calendarService: CalendarService;
  readonly createScheduledManualOrder: CreateScheduledManualOrder;
  readonly manualOrderService: ManualOrderService;
  readonly isFocused?: boolean;
  readonly initialDate?: string;
  readonly onSelectDay: (date: string) => void;
  readonly onOpenOrder: (orderId: string) => void;
}

type CalendarLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly entries: CalendarEntry[]; readonly orders: ManualOrder[] }
  | { readonly status: 'error' };

type CalendarFormMode =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly entryId: string; readonly status: CalendarEntryStatus; readonly hasManualOrder: boolean }
  | null;

interface CalendarFormValues {
  readonly customerName: string;
  readonly serviceAddress: string;
  readonly title: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly type: CalendarEntryType;
}

const ENTRY_TYPES = Object.values(CALENDAR_ENTRY_TYPES);

export function CalendarScreen({
  calendarService,
  createScheduledManualOrder,
  manualOrderService,
  isFocused = true,
  initialDate,
  onSelectDay,
  onOpenOrder,
}: CalendarScreenProps): React.JSX.Element {
  const [weekStart, setWeekStart] = useState(() => startOfCalendarWeek(parseLocalDateKey(initialDate ?? '') ?? new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(parseLocalDateKey(initialDate ?? '') ?? new Date()));
  const [isMonthSelectorVisible, setIsMonthSelectorVisible] = useState(false);
  const range = getWeekLoadRange(weekStart);
  const [loadState, setLoadState] = useState<CalendarLoadState>({ status: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [formMode, setFormMode] = useState<CalendarFormMode>(null);
  const [formValues, setFormValues] = useState<CalendarFormValues>(createDefaultFormValues);
  const [formError, setFormError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const mutationInProgress = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }
    let isCurrentLoad = true;
    setLoadState({ status: 'loading' });
    Promise.all([
      calendarService.getEntries(range.from, range.to),
      manualOrderService.getOrders(),
    ]).then(([entries, orders]) => {
        if (isCurrentLoad) {
          setLoadState({ status: 'loaded', entries, orders });
        }
      })
      .catch(() => {
        if (isCurrentLoad) {
          setLoadState({ status: 'error' });
        }
      });

    return () => {
      isCurrentLoad = false;
    };
  }, [calendarService, isFocused, loadAttempt, manualOrderService, range.from, range.to]);

  const reloadEntries = async (): Promise<void> => {
    try {
      const [entries, orders] = await Promise.all([
        calendarService.getEntries(range.from, range.to),
        manualOrderService.getOrders(),
      ]);
      if (isMounted.current) {
        setLoadState({ status: 'loaded', entries, orders });
      }
    } catch {
      if (isMounted.current) {
        setLoadState({ status: 'error' });
      }
    }
  };

  const openCreateForm = () => {
    setOperationError(null);
    setFormError(null);
    setFormValues(createDefaultFormValues(parseLocalDateKey(selectedDate) ?? new Date()));
    setFormMode({ kind: 'create' });
  };

  const openEditForm = (entry: CalendarEntry) => {
    setOperationError(null);
    setFormError(null);
    setFormValues({
      customerName: '',
      serviceAddress: '',
      title: entry.title,
      startAt: formatLocalDateTimeInput(new Date(entry.startAt)),
      endAt: formatLocalDateTimeInput(new Date(entry.endAt)),
      type: entry.type,
    });
    const hasManualOrder = loadState.status === 'loaded' && loadState.orders.some(order => order.calendarEntryId === entry.id);
    setFormMode({ kind: 'edit', entryId: entry.id, status: entry.status, hasManualOrder });
  };

  const closeForm = () => {
    setFormMode(null);
    setFormError(null);
  };

  const updateFormValue = <K extends keyof CalendarFormValues>(
    key: K,
    value: CalendarFormValues[K],
  ) => {
    setFormValues(current => ({ ...current, [key]: value }));
    setFormError(null);
  };

  const saveEntry = async (): Promise<void> => {
    if (!formMode || mutationInProgress.current) {
      return;
    }

    const startAt = localDateTimeToUtc(formValues.startAt);
    const endAt = localDateTimeToUtc(formValues.endAt);
    if (!startAt || !endAt) {
      setFormError('Enter a valid local date and time for both start and end.');
      return;
    }
    if (Date.parse(startAt) >= Date.parse(endAt)) {
      setFormError('Start time must be before end time.');
      return;
    }
    if (
      formMode.kind === 'create' && formValues.type === CALENDAR_ENTRY_TYPES.EXTERNAL_ORDER &&
      (!formValues.customerName.trim() || !formValues.title.trim() || !formValues.serviceAddress.trim())
    ) {
      setFormError('Enter customer, service, and address.');
      return;
    }

    mutationInProgress.current = true;
    setIsMutating(true);
    setFormError(null);
    setOperationError(null);
    try {
      const changes = {
        startAt,
        endAt,
        type: formValues.type,
        title: formValues.title,
      };
      if (formMode.kind === 'create') {
        if (formValues.type === CALENDAR_ENTRY_TYPES.EXTERNAL_ORDER) {
          await createScheduledManualOrder.execute({
            customerName: formValues.customerName.trim(),
            serviceDescription: formValues.title.trim(),
            serviceAddress: formValues.serviceAddress.trim(),
            startAt,
            endAt,
          });
        } else {
          await calendarService.createEntry(changes);
        }
      } else {
        await calendarService.updateEntry(formMode.entryId, changes);
      }
      if (isMounted.current) {
        setFormMode(null);
        setFormError(null);
      }
      await reloadEntries();
    } catch (error) {
      if (isMounted.current) {
        const isCreatingOrder = formMode.kind === 'create' && formValues.type === CALENDAR_ENTRY_TYPES.EXTERNAL_ORDER;
        setOperationError(isCreatingOrder && getErrorCode(error) === 'ScheduledOrderCompensationFailed'
          ? 'Couldn’t finish saving the order. Check Calendar before retrying.'
          : isCreatingOrder
            ? "Couldn't create the order. Please try again."
            : formMode.kind === 'create'
              ? "Couldn't create the calendar entry. Please try again."
              : "Couldn't update the calendar entry. Please try again.");
      }
    } finally {
      mutationInProgress.current = false;
      if (isMounted.current) {
        setIsMutating(false);
      }
    }
  };

  const deleteEntry = async (entryId: string): Promise<void> => {
    if (mutationInProgress.current) {
      return;
    }

    mutationInProgress.current = true;
    setIsMutating(true);
    setOperationError(null);
    try {
      await calendarService.deleteEntry(entryId);
      await reloadEntries();
    } catch {
      if (isMounted.current) {
        setOperationError("Couldn't delete the calendar entry. Please try again.");
      }
    } finally {
      mutationInProgress.current = false;
      if (isMounted.current) {
        setIsMutating(false);
      }
    }
  };

  const ordersByEntryId = new Map(
    (loadState.status === 'loaded' ? loadState.orders : []).map(order => [order.calendarEntryId, order]),
  );
  const handleDaySelect = (date: string) => {
    setSelectedDate(date);
    onSelectDay(date);
  };
  const handleWeekPageSelected = (position: number) => {
    if (position === 1) {
      return;
    }
    const daysToMove = position === 0 ? -7 : 7;
    setWeekStart(current => addCalendarDays(current, daysToMove));
    setSelectedDate(current => {
      const parsed = parseLocalDateKey(current) ?? new Date();
      return toLocalDateKey(addCalendarDays(parsed, daysToMove));
    });
  };
  const handleMonthSelect = (date: string) => {
    const selected = parseLocalDateKey(date);
    if (selected) {
      setSelectedDate(date);
      setWeekStart(startOfCalendarWeek(selected));
    }
    setIsMonthSelectorVisible(false);
  };

  return (
    <View style={styles.screen} testID="calendar-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.range} testID="calendar-week-range">{formatCalendarWeek(weekStart)}</Text>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" onPress={() => setIsMonthSelectorVisible(true)} style={styles.secondaryButton} testID="calendar-open-month-selector">
            <Text style={styles.secondaryButtonText}>Month</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isMutating}
            onPress={openCreateForm}
            style={[styles.primaryButton, isMutating && styles.disabledButton]}
            testID="calendar-create-button">
            <Text style={styles.primaryButtonText}>Add entry</Text>
          </Pressable>
        </View>
      </View>

      {operationError ? (
        <Text accessibilityRole="alert" style={styles.error} testID="calendar-operation-error">
          {operationError}
        </Text>
      ) : null}

      {formMode ? (
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <CalendarEntryForm
            error={formError}
            hasManualOrder={formMode.kind === 'edit' && formMode.hasManualOrder}
            isEditing={formMode.kind === 'edit'}
            isSaving={isMutating}
            onCancel={closeForm}
            onSave={saveEntry}
            onTypeChange={type => updateFormValue('type', type)}
            onValueChange={updateFormValue}
            status={formMode.kind === 'edit' ? formMode.status : null}
            values={formValues}
          />
        </ScrollView>
      ) : null}

      {loadState.status === 'loading' ? (
        <View style={styles.messageCard} testID="calendar-loading">
          <ActivityIndicator color="#176B58" />
          <Text style={styles.message}>Loading calendar…</Text>
        </View>
      ) : null}

      {loadState.status === 'error' ? (
        <View style={styles.messageCard} testID="calendar-error">
          <Text style={styles.messageTitle}>We couldn’t load your calendar</Text>
          <Text style={styles.message}>Please try again.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLoadAttempt(attempt => attempt + 1)}
            style={styles.secondaryButton}
            testID="calendar-retry-button">
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {loadState.status === 'loaded' ? (
        <PagerView
          key={toLocalDateKey(weekStart)}
          initialPage={1}
          onPageSelected={(event: { readonly nativeEvent: { readonly position: number } }) => handleWeekPageSelected(event.nativeEvent.position)}
          offscreenPageLimit={1}
          style={styles.weekPager}
          scrollEnabled
          testID="calendar-week-pager">
          {[-1, 0, 1].map(offset => {
            const pageWeekStart = addCalendarDays(weekStart, offset * 7);
            const pageRange = localWeekRange(pageWeekStart);
            const entries = loadState.entries.filter(entry =>
              Date.parse(entry.startAt) < Date.parse(pageRange.to) &&
              Date.parse(pageRange.from) < Date.parse(entry.endAt));
            return (
              <View key={toLocalDateKey(pageWeekStart)} collapsable={false}>
                <CalendarWeekPage
                  disabled={isMutating}
                  entries={entries}
                  isCurrentWeek={offset === 0}
                  onDelete={deleteEntry}
                  onEdit={openEditForm}
                  onOpenOrder={onOpenOrder}
                  onSelectDay={handleDaySelect}
                  ordersByEntryId={ordersByEntryId}
                  selectedDate={selectedDate}
                  today={toLocalDateKey(new Date())}
                  weekStart={pageWeekStart}
                />
              </View>
            );
          })}
        </PagerView>
      ) : null}

      <MonthSelector
        onClose={() => setIsMonthSelectorVisible(false)}
        onSelectDate={handleMonthSelect}
        selectedDate={selectedDate}
        visible={isMonthSelectorVisible}
      />
    </View>
  );
}

interface CalendarWeekPageProps {
  readonly disabled: boolean;
  readonly entries: CalendarEntry[];
  readonly isCurrentWeek: boolean;
  readonly onDelete: (entryId: string) => Promise<void>;
  readonly onEdit: (entry: CalendarEntry) => void;
  readonly onOpenOrder: (orderId: string) => void;
  readonly onSelectDay: (date: string) => void;
  readonly ordersByEntryId: Map<string, ManualOrder>;
  readonly selectedDate: string;
  readonly today: string;
  readonly weekStart: Date;
}

function CalendarWeekPage({
  disabled,
  entries,
  isCurrentWeek,
  onDelete,
  onEdit,
  onOpenOrder,
  onSelectDay,
  ordersByEntryId,
  selectedDate,
  today,
  weekStart,
}: CalendarWeekPageProps): React.JSX.Element {
  const days = getCalendarWeekDates(weekStart);
  const sortedEntries = [...entries].sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt));

  return (
    <View style={styles.weekPage}>
      <View style={styles.dayStrip} testID="calendar-week-days">
        {days.map(day => {
          const date = toLocalDateKey(day);
          const isToday = date === today;
          const isSelected = date === selectedDate;
          return (
            <Pressable
              accessibilityLabel={`${isToday ? 'Today, ' : ''}${day.toLocaleDateString(undefined, { dateStyle: 'full' })}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={date}
              onPress={() => onSelectDay(date)}
              style={[styles.dayButton, isSelected && styles.selectedDayButton, isToday && styles.todayDayButton]}
              testID={`calendar-day-${date}`}>
              <Text style={[styles.dayName, isSelected && styles.selectedDayText]}>
                {day.toLocaleDateString(undefined, { weekday: 'short' })}
              </Text>
              <Text style={[styles.dayNumber, isSelected && styles.selectedDayText, isToday && !isSelected && styles.todayDayNumber]}>
                {day.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={styles.weekEntries} keyboardShouldPersistTaps="handled">
        {sortedEntries.length === 0 ? (
          <View
            style={styles.messageCard}
            testID={isCurrentWeek ? 'calendar-empty' : `calendar-empty-${toLocalDateKey(weekStart)}`}>
            <Text style={styles.messageTitle}>Nothing scheduled this week</Text>
          </View>
        ) : sortedEntries.map(entry => {
          const order = ordersByEntryId.get(entry.id);
          return (
            <CalendarEntryCard
              disabled={disabled}
              entry={entry}
              key={entry.id}
              onDelete={() => onDelete(entry.id)}
              onEdit={() => onEdit(entry)}
              onOpenOrder={order ? () => onOpenOrder(order.id) : undefined}
              order={order}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

interface CalendarEntryFormProps {
  readonly error: string | null;
  readonly hasManualOrder: boolean;
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  readonly onCancel: () => void;
  readonly onSave: () => Promise<void>;
  readonly onTypeChange: (type: CalendarEntryType) => void;
  readonly onValueChange: <K extends keyof CalendarFormValues>(
    key: K,
    value: CalendarFormValues[K],
  ) => void;
  readonly status: CalendarEntryStatus | null;
  readonly values: CalendarFormValues;
}

function CalendarEntryForm({
  error,
  hasManualOrder,
  isEditing,
  isSaving,
  onCancel,
  onSave,
  onTypeChange,
  onValueChange,
  status,
  values,
}: CalendarEntryFormProps): React.JSX.Element {
  const isCreatingOrder = !isEditing && values.type === CALENDAR_ENTRY_TYPES.EXTERNAL_ORDER;

  return (
    <View style={styles.form} testID="calendar-entry-form">
      <Text style={styles.sectionTitle}>{isEditing ? 'Edit entry' : isCreatingOrder ? 'Create order' : 'Create entry'}</Text>

      {isEditing && status ? (
        <Text accessibilityLabel={`Status ${status} (read only)`} style={styles.readOnly}>
          Status: {status}
        </Text>
      ) : null}

      {isCreatingOrder ? (
        <>
          <Text style={styles.fieldLabel}>Customer</Text>
          <TextInput
            accessibilityLabel="Order customer"
            editable={!isSaving}
            onChangeText={value => onValueChange('customerName', value)}
            style={styles.input}
            testID="calendar-order-customer-input"
            value={values.customerName}
          />
        </>
      ) : null}

      <Text style={styles.fieldLabel}>{isCreatingOrder ? 'Service' : 'Title'}</Text>
      <TextInput
        accessibilityLabel={isCreatingOrder ? 'Order service' : 'Calendar entry title'}
        editable={!isSaving}
        onChangeText={value => onValueChange('title', value)}
        style={styles.input}
        testID="calendar-title-input"
        value={values.title}
      />

      {isCreatingOrder ? (
        <>
          <Text style={styles.fieldLabel}>Address</Text>
          <TextInput
            accessibilityLabel="Order address"
            editable={!isSaving}
            onChangeText={value => onValueChange('serviceAddress', value)}
            style={styles.input}
            testID="calendar-order-address-input"
            value={values.serviceAddress}
          />
        </>
      ) : null}

      <Text style={styles.fieldLabel}>Start (local time)</Text>
      <TextInput
        accessibilityLabel="Start date and time in local time"
        autoCapitalize="none"
        editable={!isSaving}
        onChangeText={value => onValueChange('startAt', value)}
        placeholder="YYYY-MM-DDTHH:mm"
        style={styles.input}
        testID="calendar-start-input"
        value={values.startAt}
      />

      <Text style={styles.fieldLabel}>End (local time)</Text>
      <TextInput
        accessibilityLabel="End date and time in local time"
        autoCapitalize="none"
        editable={!isSaving}
        onChangeText={value => onValueChange('endAt', value)}
        placeholder="YYYY-MM-DDTHH:mm"
        style={styles.input}
        testID="calendar-end-input"
        value={values.endAt}
      />

      <Text style={styles.fieldLabel}>Type</Text>
      <View style={styles.types}>
        {ENTRY_TYPES.map(type => {
          const orderTypeChangeBlocked = isEditing && (
            (type === CALENDAR_ENTRY_TYPES.EXTERNAL_ORDER && !hasManualOrder && values.type !== CALENDAR_ENTRY_TYPES.EXTERNAL_ORDER) ||
            (hasManualOrder && type !== CALENDAR_ENTRY_TYPES.EXTERNAL_ORDER)
          );
          return (
            <Pressable
              accessibilityLabel={`Type ${type}`}
              accessibilityRole="button"
              accessibilityState={{ selected: values.type === type }}
              disabled={isSaving || orderTypeChangeBlocked}
              key={type}
              onPress={() => {
                if (!orderTypeChangeBlocked) {
                  onTypeChange(type);
                }
              }}
              style={[styles.typeOption, values.type === type && styles.selectedTypeOption]}
              testID={`calendar-type-${type}`}>
              <Text style={[styles.typeText, values.type === type && styles.selectedTypeText]}>
                {type}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error} testID="calendar-form-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={onSave}
        style={[styles.primaryButton, isSaving && styles.disabledButton]}
        testID="calendar-save-button">
        <Text style={styles.primaryButtonText}>
          {isSaving ? 'Saving…' : isEditing ? 'Save changes' : isCreatingOrder ? 'Create order' : 'Create entry'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={onCancel}
        style={styles.secondaryButton}
        testID="calendar-cancel-button">
        <Text style={styles.secondaryButtonText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

interface CalendarEntryCardProps {
  readonly disabled: boolean;
  readonly entry: CalendarEntry;
  readonly onDelete: () => Promise<void>;
  readonly onEdit: () => void;
  readonly onOpenOrder?: () => void;
  readonly order?: ManualOrder;
}

function CalendarEntryCard({
  disabled,
  entry,
  onDelete,
  onEdit,
  onOpenOrder,
  order,
}: CalendarEntryCardProps): React.JSX.Element {
  const accessibleTitle = entry.title || 'calendar entry';
  const details = (
    <>
      <Text style={styles.entryTitle} testID={`calendar-entry-${entry.id}-title`}>
        {entry.title}
      </Text>
      {order ? <Text style={styles.entryMetadata}>{order.customerName} · {order.serviceAddress}</Text> : null}
      <Text style={styles.entryTime} testID={`calendar-entry-${entry.id}-start`}>
        Start: {formatDisplayDateTime(entry.startAt)}
      </Text>
      <Text style={styles.entryTime} testID={`calendar-entry-${entry.id}-end`}>
        End: {formatDisplayDateTime(entry.endAt)}
      </Text>
      <Text style={styles.entryMetadata} testID={`calendar-entry-${entry.id}-type`}>
        Type: {entry.type}
      </Text>
      <Text style={styles.entryMetadata} testID={`calendar-entry-${entry.id}-status`}>
        Status: {entry.status}
      </Text>
    </>
  );
  return (
    <View style={styles.entryCard} testID={`calendar-entry-${entry.id}`}>
      {onOpenOrder ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open order ${order?.customerName ?? accessibleTitle}`} onPress={onOpenOrder} testID={`calendar-open-order-${order?.id}`}>
          {details}
        </Pressable>
      ) : details}
      <View style={styles.entryActions}>
        <Pressable
          accessibilityLabel={`Edit ${accessibleTitle}`}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onEdit}
          style={styles.entryAction}
          testID={`calendar-edit-${entry.id}`}>
          <Text style={styles.entryActionText}>Edit</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Delete ${accessibleTitle}`}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onDelete}
          style={styles.entryAction}
          testID={`calendar-delete-${entry.id}`}>
          <Text style={styles.deleteActionText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function getWeekLoadRange(weekStart: Date): { readonly from: string; readonly to: string } {
  const from = localWeekRange(addCalendarDays(weekStart, -7));
  const to = localWeekRange(addCalendarDays(weekStart, 14));
  return {
    from: from.from,
    to: to.to,
  };
}

function createDefaultFormValues(now = new Date()): CalendarFormValues {
  const start = new Date(now.getTime());
  start.setSeconds(0, 0);
  const end = new Date(start.getTime());
  end.setHours(end.getHours() + 1);
  return {
    customerName: '',
    serviceAddress: '',
    title: '',
    startAt: formatLocalDateTimeInput(start),
    endAt: formatLocalDateTimeInput(end),
    type: CALENDAR_ENTRY_TYPES.PERSONAL,
  };
}

function formatLocalDateTimeInput(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }
  return date.toISOString();
}

function formatDisplayDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  return typeof error.code === 'string' ? error.code : null;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: '#F4F7F6',
  },
  header: {
    gap: 10,
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  weekPager: {
    flex: 1,
    minHeight: 0,
  },
  weekPage: {
    flex: 1,
  },
  dayStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 2,
    marginBottom: 10,
  },
  dayButton: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 13,
  },
  selectedDayButton: {
    backgroundColor: '#176B58',
  },
  todayDayButton: {
    borderWidth: 1,
    borderColor: '#176B58',
  },
  dayName: {
    color: '#648078',
    fontSize: 12,
    fontWeight: '600',
  },
  dayNumber: {
    color: '#1C342E',
    fontSize: 16,
    fontWeight: '700',
  },
  todayDayNumber: {
    color: '#176B58',
  },
  selectedDayText: {
    color: '#FFFFFF',
  },
  weekEntries: {
    flexGrow: 1,
    gap: 12,
    paddingBottom: 20,
  },
  formScroll: {
    flexGrow: 1,
  },
  title: {
    color: '#173C34',
    fontSize: 30,
    fontWeight: '700',
  },
  range: {
    color: '#648078',
    fontSize: 14,
  },
  messageCard: {
    alignItems: 'center',
    gap: 12,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E7EEEB',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  messageTitle: {
    color: '#1C342E',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#648078',
    textAlign: 'center',
  },
  entries: {
    gap: 14,
  },
  entryCard: {
    gap: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DCE9E3',
    borderLeftWidth: 5,
    borderLeftColor: '#176B58',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  entryTitle: {
    color: '#1C342E',
    fontSize: 18,
    fontWeight: '700',
  },
  entryTime: {
    color: '#315B4E',
    fontSize: 14,
  },
  entryMetadata: {
    color: '#648078',
    fontSize: 13,
  },
  entryActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  entryAction: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#EAF3EF',
  },
  entryActionText: {
    color: '#176B58',
    fontWeight: '700',
  },
  deleteActionText: {
    color: '#A13D37',
    fontWeight: '700',
  },
  form: {
    gap: 10,
    marginBottom: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DCE9E3',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    marginBottom: 4,
    color: '#1C342E',
    fontSize: 20,
    fontWeight: '700',
  },
  fieldLabel: {
    marginTop: 4,
    color: '#648078',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#C8D9D1',
    borderRadius: 10,
    color: '#263C35',
    fontSize: 15,
    backgroundColor: '#FFFFFF',
  },
  types: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#C8D9D1',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  selectedTypeOption: {
    borderColor: '#176B58',
    backgroundColor: '#EAF3EF',
  },
  typeText: {
    color: '#648078',
    fontSize: 13,
  },
  selectedTypeText: {
    color: '#176B58',
    fontWeight: '700',
  },
  readOnly: {
    color: '#648078',
    fontSize: 14,
  },
  error: {
    color: '#A13D37',
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingHorizontal: 18,
    borderRadius: 13,
    backgroundColor: '#176B58',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: '#315B4E',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
