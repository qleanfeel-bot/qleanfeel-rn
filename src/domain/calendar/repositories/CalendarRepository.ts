import type { CalendarEntry } from '../entities/CalendarEntry';

export type CreateCalendarEntryInput = Pick<
  CalendarEntry,
  'startAt' | 'endAt' | 'type' | 'title'
>;

export type UpdateCalendarEntryChanges = Partial<CreateCalendarEntryInput>;

/** Application-facing access to calendar entries. */
export interface CalendarRepository {
  getEntries(from: string, to: string): Promise<CalendarEntry[]>;
  createEntry(entry: CreateCalendarEntryInput): Promise<CalendarEntry>;
  updateEntry(entryId: string, changes: UpdateCalendarEntryChanges): Promise<CalendarEntry>;
  deleteEntry(entryId: string): Promise<void>;
}
