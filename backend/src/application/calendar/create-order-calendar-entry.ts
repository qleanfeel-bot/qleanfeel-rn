import type {
  Clock,
  IdentifierGenerator,
} from '../identity/ports/credential-services.js';
import type { UnitOfWorkContext } from '../ports/unit-of-work.js';
import { CalendarEntry } from '../../domain/calendar/calendar-entry.js';
import type { CalendarSchedule } from '../../domain/calendar/calendar-entry.js';
import { CalendarEntryRepository } from './ports/calendar-entry-repository.js';
import { CalendarScheduleCreator } from './ports/calendar-schedule-creator.js';

export class CreateOrderCalendarEntry extends CalendarScheduleCreator {
  constructor(
    private readonly entries: CalendarEntryRepository,
    private readonly identifiers: IdentifierGenerator,
    private readonly clock: Clock,
  ) {
    super();
  }

  async createForManualOrder(
    ownerUserId: string,
    schedule: CalendarSchedule,
    context: UnitOfWorkContext,
  ): Promise<CalendarEntry> {
    const now = this.clock.now();
    const entry = CalendarEntry.createScheduled(
      this.identifiers.next(),
      ownerUserId,
      schedule,
      'Cleaning',
      now,
    );
    await this.entries.create(entry, context);
    return entry;
  }
}
