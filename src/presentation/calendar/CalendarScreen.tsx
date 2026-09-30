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
import {
  CALENDAR_ENTRY_TYPES,
  type CalendarEntry,
  type CalendarEntryStatus,
  type CalendarEntryType,
} from '../../domain/calendar/entities/CalendarEntry';

interface CalendarScreenProps {
  readonly calendarService: CalendarService;
}

type CalendarLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly entries: CalendarEntry[] }
  | { readonly status: 'error' };

type CalendarFormMode =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly entryId: string; readonly status: CalendarEntryStatus }
  | null;

interface CalendarFormValues {
  readonly title: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly type: CalendarEntryType;
}

interface CalendarRange {
  readonly from: string;
  readonly to: string;
  readonly label: string;
}

const ENTRY_TYPES = Object.values(CALENDAR_ENTRY_TYPES);

export function CalendarScreen({ calendarService }: CalendarScreenProps): React.JSX.Element {
  const [range] = useState(createDevelopmentRange);
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
    let isCurrentLoad = true;
    setLoadState({ status: 'loading' });
    calendarService
      .getEntries(range.from, range.to)
      .then(entries => {
        if (isCurrentLoad) {
          setLoadState({ status: 'loaded', entries });
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
  }, [calendarService, loadAttempt, range.from, range.to]);

  const reloadEntries = async (): Promise<void> => {
    try {
      const entries = await calendarService.getEntries(range.from, range.to);
      if (isMounted.current) {
        setLoadState({ status: 'loaded', entries });
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
    setFormValues(createDefaultFormValues());
    setFormMode({ kind: 'create' });
  };

  const openEditForm = (entry: CalendarEntry) => {
    setOperationError(null);
    setFormError(null);
    setFormValues({
      title: entry.title,
      startAt: formatLocalDateTimeInput(new Date(entry.startAt)),
      endAt: formatLocalDateTimeInput(new Date(entry.endAt)),
      type: entry.type,
    });
    setFormMode({ kind: 'edit', entryId: entry.id, status: entry.status });
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
        await calendarService.createEntry(changes);
      } else {
        await calendarService.updateEntry(formMode.entryId, changes);
      }
      if (isMounted.current) {
        setFormMode(null);
        setFormError(null);
      }
      await reloadEntries();
    } catch {
      if (isMounted.current) {
        setOperationError(
          formMode.kind === 'create'
            ? "Couldn't create the calendar entry. Please try again."
            : "Couldn't update the calendar entry. Please try again.",
        );
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

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      testID="calendar-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.range}>{range.label}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={isMutating}
          onPress={openCreateForm}
          style={[styles.primaryButton, isMutating && styles.disabledButton]}
          testID="calendar-create-button">
          <Text style={styles.primaryButtonText}>Add entry</Text>
        </Pressable>
      </View>

      {operationError ? (
        <Text accessibilityRole="alert" style={styles.error} testID="calendar-operation-error">
          {operationError}
        </Text>
      ) : null}

      {formMode ? (
        <CalendarEntryForm
          error={formError}
          isEditing={formMode.kind === 'edit'}
          isSaving={isMutating}
          onCancel={closeForm}
          onSave={saveEntry}
          onTypeChange={type => updateFormValue('type', type)}
          onValueChange={updateFormValue}
          status={formMode.kind === 'edit' ? formMode.status : null}
          values={formValues}
        />
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
            onPress={() => setLoadAttempt(current => current + 1)}
            style={styles.secondaryButton}
            testID="calendar-retry-button">
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {loadState.status === 'loaded' && loadState.entries.length === 0 ? (
        <View style={styles.messageCard} testID="calendar-empty">
          <Text style={styles.messageTitle}>No calendar entries</Text>
        </View>
      ) : null}

      {loadState.status === 'loaded' && loadState.entries.length > 0 ? (
        <View style={styles.entries} testID="calendar-list">
          {loadState.entries.map(entry => (
            <CalendarEntryCard
              disabled={isMutating}
              entry={entry}
              key={entry.id}
              onDelete={() => deleteEntry(entry.id)}
              onEdit={() => openEditForm(entry)}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

interface CalendarEntryFormProps {
  readonly error: string | null;
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
  isEditing,
  isSaving,
  onCancel,
  onSave,
  onTypeChange,
  onValueChange,
  status,
  values,
}: CalendarEntryFormProps): React.JSX.Element {
  return (
    <View style={styles.form} testID="calendar-entry-form">
      <Text style={styles.sectionTitle}>{isEditing ? 'Edit entry' : 'Create entry'}</Text>

      {isEditing && status ? (
        <Text accessibilityLabel={`Status ${status} (read only)`} style={styles.readOnly}>
          Status: {status}
        </Text>
      ) : null}

      <Text style={styles.fieldLabel}>Title</Text>
      <TextInput
        accessibilityLabel="Calendar entry title"
        editable={!isSaving}
        onChangeText={value => onValueChange('title', value)}
        style={styles.input}
        testID="calendar-title-input"
        value={values.title}
      />

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
        {ENTRY_TYPES.map(type => (
          <Pressable
            accessibilityLabel={`Type ${type}`}
            accessibilityRole="button"
            accessibilityState={{ selected: values.type === type }}
            disabled={isSaving}
            key={type}
            onPress={() => onTypeChange(type)}
            style={[styles.typeOption, values.type === type && styles.selectedTypeOption]}
            testID={`calendar-type-${type}`}>
            <Text style={[styles.typeText, values.type === type && styles.selectedTypeText]}>
              {type}
            </Text>
          </Pressable>
        ))}
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
          {isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Create entry'}
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
}

function CalendarEntryCard({
  disabled,
  entry,
  onDelete,
  onEdit,
}: CalendarEntryCardProps): React.JSX.Element {
  const accessibleTitle = entry.title || 'calendar entry';
  return (
    <View style={styles.entryCard} testID={`calendar-entry-${entry.id}`}>
      <Text style={styles.entryTitle} testID={`calendar-entry-${entry.id}-title`}>
        {entry.title}
      </Text>
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

function createDevelopmentRange(now = new Date()): CalendarRange {
  const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const toDate = new Date(fromDate);
  toDate.setDate(toDate.getDate() + 30);
  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    label: `Upcoming 30 days · ${fromDate.toLocaleDateString()} – ${toDate.toLocaleDateString()}`,
  };
}

function createDefaultFormValues(now = new Date()): CalendarFormValues {
  const start = new Date(now.getTime());
  start.setSeconds(0, 0);
  const end = new Date(start.getTime());
  end.setHours(end.getHours() + 1);
  return {
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

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: '#F4F7F6',
  },
  header: {
    gap: 10,
    marginBottom: 22,
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
