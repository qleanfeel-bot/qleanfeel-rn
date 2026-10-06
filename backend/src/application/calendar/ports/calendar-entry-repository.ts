import type { UnitOfWorkContext } from '../../ports/unit-of-work.js';
import type { CalendarEntry } from '../../../domain/calendar/calendar-entry.js';

export abstract class CalendarEntryRepository {
  abstract create(
    entry: CalendarEntry,
    context: UnitOfWorkContext,
  ): Promise<void>;
}
