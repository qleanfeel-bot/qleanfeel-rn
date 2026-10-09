import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';
import type { Clock } from '../identity/ports/credential-services.js';
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
import { InvalidCleaningSchedulingError } from '../../domain/cleanings/cleaning.js';
import { loadOwnedCleaning } from './cleaning-lifecycle-command-support.js';
import { CleaningLifecycleRepository } from './ports/cleaning-lifecycle-repository.js';
import type { CalendarSchedule } from '../../domain/calendar/calendar-entry.js';
import { CalendarScheduleCreator } from '../calendar/ports/calendar-schedule-creator.js';

export interface ScheduleCleaningInput {
  readonly schedule: CalendarSchedule;
  readonly expectedCleaningVersion: number;
}

export class ScheduleCleaning {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly cleanings: CleaningLifecycleRepository,
    private readonly calendar: CalendarScheduleCreator,
    private readonly policy: CleaningLifecyclePolicy,
    private readonly clock: Clock,
  ) {}

  async execute(
    principal: AuthenticatedPrincipal,
    cleaningId: string,
    input: ScheduleCleaningInput,
  ) {
    assertValidSchedule(input.schedule);
    return this.unitOfWork.execute(async context => {
      const record = await loadOwnedCleaning(
        this.cleanings,
        this.policy,
        principal,
        cleaningId,
        CLEANING_LIFECYCLE_OPERATIONS.SCHEDULE,
        context,
      );
      if (record.cleaning.version !== input.expectedCleaningVersion) {
        throw new CleaningVersionConflictError();
      }
      if (
        record.cleaning.status !== CLEANING_STATUSES.PLANNED ||
        record.cleaning.calendarEntryId !== null
      ) {
        throw new CleaningSchedulingConflictError();
      }

      const entry = await this.calendar.createForCleaning(
        record.orderOwnerUserId,
        input.schedule,
        context,
      );
      let updated;
      try {
        updated = record.cleaning.scheduleWithCalendarEntry(
          entry.id,
          this.clock.now(),
        );
      } catch (error) {
        if (!(error instanceof InvalidCleaningSchedulingError)) throw error;
        throw new CleaningSchedulingConflictError();
      }
      const saved = await this.cleanings.associateScheduledCalendarEntry(
        updated,
        record.cleaning.version,
        context,
      );
      if (!saved) throw new CleaningVersionConflictError();
      return updated;
    });
  }
}
