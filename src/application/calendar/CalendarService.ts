import type {
  CalendarRepository,
  CreateCalendarEntryInput,
  UpdateCalendarEntryChanges,
} from '../../domain/calendar/repositories/CalendarRepository';
import type { CalendarEntry } from '../../domain/calendar/entities/CalendarEntry';

/** Application operations for retrieving and managing calendar entries. */
export class CalendarService {
  public constructor(private readonly calendar: CalendarRepository) {}

  public getEntries(from: string, to: string): Promise<CalendarEntry[]> {
    return this.calendar.getEntries(from, to);
  }

  public getEntry(entryId: string): Promise<CalendarEntry> {
    return this.calendar.getEntry(entryId);
  }

  public createEntry(entry: CreateCalendarEntryInput): Promise<CalendarEntry> {
    return this.calendar.createEntry(entry);
  }

  public updateEntry(
    entryId: string,
    changes: UpdateCalendarEntryChanges,
  ): Promise<CalendarEntry> {
    return this.calendar.updateEntry(entryId, changes);
  }

  public deleteEntry(entryId: string): Promise<void> {
    return this.calendar.deleteEntry(entryId);
  }
}
