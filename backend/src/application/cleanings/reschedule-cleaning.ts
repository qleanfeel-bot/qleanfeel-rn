import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import { assertValidSchedule } from '../../domain/calendar/calendar-entry.js';
import { CLEANING_STATUSES } from '../../domain/cleanings/cleaning.js';
import {
  CLEANING_LIFECYCLE_OPERATIONS,
  CleaningLifecyclePolicy,
} from './cleaning-lifecycle-policy.js';
import {
  CleaningSchedulingConflictError,
  CleaningVersionConflictError,
} from './cleaning-lifecycle-errors.js';
import { loadOwnedCleaning } from './cleaning-lifecycle-command-support.js';
import { CleaningLifecycleRepository } from './ports/cleaning-lifecycle-repository.js';
import type { CalendarSchedule } from '../../domain/calendar/calendar-entry.js';
import { CalendarScheduleCreator } from '../calendar/ports/calendar-schedule-creator.js';

export interface RescheduleCleaningInput {
  readonly schedule: CalendarSchedule;
  readonly expectedCleaningVersion: number;
  readonly expectedCalendarEntryVersion: number;
}

export class RescheduleCleaning {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly cleanings: CleaningLifecycleRepository,
    private readonly calendar: CalendarScheduleCreator,
    private readonly policy: CleaningLifecyclePolicy,
  ) {}

  async execute(
    principal: AuthenticatedPrincipal,
    cleaningId: string,
    input: RescheduleCleaningInput,
  ) {
    assertValidSchedule(input.schedule);
    return this.unitOfWork.execute(async context => {
      const record = await loadOwnedCleaning(
        this.cleanings,
        this.policy,
        principal,
        cleaningId,
        CLEANING_LIFECYCLE_OPERATIONS.RESCHEDULE,
        context,
      );
      if (record.cleaning.version !== input.expectedCleaningVersion) {
        throw new CleaningVersionConflictError();
      }
      if (
        record.cleaning.status !== CLEANING_STATUSES.PLANNED ||
        record.cleaning.calendarEntryId === null
      ) {
        throw new CleaningSchedulingConflictError();
      }

      const updatedEntry = await this.calendar.rescheduleExisting(
        record.cleaning.calendarEntryId,
        input.schedule,
        input.expectedCalendarEntryVersion,
        context,
      );
      if (!updatedEntry) throw new CleaningSchedulingConflictError();
      return record.cleaning;
    });
  }
}
