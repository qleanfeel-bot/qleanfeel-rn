import type { UnitOfWorkContext } from '../../ports/unit-of-work.js';
import type { CalendarEntry } from '../../../domain/calendar/calendar-entry.js';
import type { CalendarSchedule } from '../../../domain/calendar/calendar-entry.js';

/** Calendar-owned scheduled-entry creation using the caller's active transaction. */
export abstract class CalendarScheduleCreator {
  abstract createForManualOrder(
    ownerUserId: string,
    schedule: CalendarSchedule,
    context: UnitOfWorkContext,
  ): Promise<CalendarEntry>;
}
