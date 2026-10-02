import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { addCalendarDays, parseLocalDateKey, startOfCalendarWeek, toLocalDateKey } from './calendarDateUtils';

interface MonthSelectorProps {
  readonly visible: boolean;
  readonly selectedDate: string;
  readonly onClose: () => void;
  readonly onSelectDate: (date: string) => void;
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function MonthSelector({ visible, selectedDate, onClose, onSelectDate }: MonthSelectorProps): React.JSX.Element {
  const selected = parseLocalDateKey(selectedDate) ?? new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  useEffect(() => {
    if (visible) {
      const date = parseLocalDateKey(selectedDate) ?? new Date();
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }, [selectedDate, visible]);

  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const firstGridDate = startOfCalendarWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => addCalendarDays(firstGridDate, index));

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.scrim}>
        <View accessibilityViewIsModal style={styles.card} testID="calendar-month-selector">
          <View style={styles.monthHeader}>
            <Pressable accessibilityLabel="Previous month" accessibilityRole="button" onPress={() => setVisibleMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.monthButton} testID="calendar-month-previous">
              <Text style={styles.monthButtonText}>‹</Text>
            </Pressable>
            <Text style={styles.monthTitle} testID="calendar-month-title">
              {visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable accessibilityLabel="Next month" accessibilityRole="button" onPress={() => setVisibleMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.monthButton} testID="calendar-month-next">
              <Text style={styles.monthButtonText}>›</Text>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekday}>
                {label}
              </Text>
            ))}
            {days.map(day => {
              const dateKey = toLocalDateKey(day);
              const isInMonth = day.getMonth() === visibleMonth.getMonth();
              const isSelected = dateKey === selectedDate;
              return (
                <Pressable
                  accessibilityLabel={day.toLocaleDateString(undefined, { dateStyle: 'full' })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={dateKey}
                  onPress={() => onSelectDate(dateKey)}
                  style={[styles.day, isSelected && styles.selectedDay]}
                  testID={`calendar-month-date-${dateKey}`}>
                  <Text style={[styles.dayText, !isInMonth && styles.outsideMonth, isSelected && styles.selectedDayText]}>
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton} testID="calendar-month-close">
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(16, 35, 29, 0.42)' },
  card: { width: '100%', maxWidth: 380, gap: 14, padding: 18, borderRadius: 22, backgroundColor: '#FFFFFF' },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#EAF3EF' },
  monthButtonText: { color: '#176B58', fontSize: 28, lineHeight: 32 },
  monthTitle: { color: '#173C34', fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', paddingVertical: 8, color: '#648078', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  day: { width: '14.2857%', height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  selectedDay: { backgroundColor: '#176B58' },
  dayText: { color: '#1C342E', fontSize: 14 },
  outsideMonth: { color: '#A9B8B2' },
  selectedDayText: { color: '#FFFFFF', fontWeight: '700' },
  closeButton: { alignItems: 'center', padding: 11, borderWidth: 1, borderColor: '#D5E1DC', borderRadius: 12 },
  closeText: { color: '#176B58', fontWeight: '700' },
});
