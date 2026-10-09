import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthenticatedPrincipal } from '../src/application/identity/authenticated-principal.js';
import {
  CleaningNotFoundError,
  CleaningSchedulingConflictError,
  CleaningVersionConflictError,
} from '../src/application/cleanings/cleaning-lifecycle-errors.js';
import { CleaningLifecyclePolicy } from '../src/application/cleanings/cleaning-lifecycle-policy.js';
import { CleaningLifecycleRepository } from '../src/application/cleanings/ports/cleaning-lifecycle-repository.js';
import { RescheduleCleaning } from '../src/application/cleanings/reschedule-cleaning.js';
import { ScheduleCleaning } from '../src/application/cleanings/schedule-cleaning.js';
import { CalendarScheduleCreator } from '../src/application/calendar/ports/calendar-schedule-creator.js';
import {
  CalendarEntry,
  InvalidCalendarScheduleError,
} from '../src/domain/calendar/calendar-entry.js';
import type { CalendarSchedule } from '../src/domain/calendar/calendar-entry.js';
import { Cleaning } from '../src/domain/cleanings/cleaning.js';
import type { UnitOfWorkContext } from '../src/application/ports/unit-of-work.js';
import { UnitOfWork } from '../src/application/ports/unit-of-work.js';
import { Clock } from '../src/application/identity/ports/credential-services.js';

const owner: AuthenticatedPrincipal = {
  userId: 'owner-user',
  sessionId: 'owner-session',
};
const now = new Date('2026-10-08T11:00:00.000Z');
const initialSchedule: CalendarSchedule = {
  startAt: '2026-10-09T10:00:00.000Z',
  endAt: '2026-10-09T11:00:00.000Z',
};
const nextSchedule: CalendarSchedule = {
  startAt: '2026-10-10T12:00:00.000Z',
  endAt: '2026-10-10T13:00:00.000Z',
};

class FixedClock extends Clock {
  now() {
    return now;
  }
}

class TestUnitOfWork extends UnitOfWork {
  calls = 0;
  async execute<T>(operation: (context: UnitOfWorkContext) => Promise<T>) {
    this.calls += 1;
    return operation({} as UnitOfWorkContext);
  }
}

class TestCleaningRepository extends CleaningLifecycleRepository {
  record: { cleaning: Cleaning; orderOwnerUserId: string } | undefined;
  associateCalls = 0;
  failAssociate = false;

  async findForLifecycle() {
    return this.record;
  }

  async updateState() {
    return false;
  }

  async associateScheduledCalendarEntry(
    cleaning: Cleaning,
    expectedVersion: number,
  ) {
    this.associateCalls += 1;
    if (
      this.failAssociate ||
      !this.record ||
      this.record.cleaning.version !== expectedVersion ||
      this.record.cleaning.status !== 'planned' ||
      this.record.cleaning.calendarEntryId !== null
    ) {
      return false;
    }
    this.record = {
      cleaning,
      orderOwnerUserId: this.record.orderOwnerUserId,
    };
    return true;
  }

  async appendLifecycleEvent() {}
}

class TestCalendarScheduleCreator extends CalendarScheduleCreator {
  entries = new Map<string, CalendarEntry>();
  creates = 0;
  nextId = 0;

  async createForManualOrder(ownerUserId: string, schedule: CalendarSchedule) {
    return this.createForCleaning(ownerUserId, schedule);
  }

  async createForCleaning(ownerUserId: string, schedule: CalendarSchedule) {
    this.creates += 1;
    this.nextId += 1;
    const entry = CalendarEntry.createScheduled(
      `calendar-${this.nextId}`,
      ownerUserId,
      schedule,
      'Cleaning',
      now,
    );
    this.entries.set(entry.id, entry);
    return entry;
  }

  async rescheduleExisting(
    entryId: string,
    schedule: CalendarSchedule,
    expectedVersion: number,
  ) {
    const current = this.entries.get(entryId);
    if (!current || current.version !== expectedVersion) return undefined;
    try {
      const updated = current.reschedule(schedule, now);
      this.entries.set(entryId, updated);
      return updated;
    } catch {
      return undefined;
    }
  }
}

function setup(
  cleaning = Cleaning.createInitial('cleaning-1', 'order-1', now),
  orderOwnerUserId = owner.userId,
) {
  const unitOfWork = new TestUnitOfWork();
  const cleanings = new TestCleaningRepository();
  cleanings.record = { cleaning, orderOwnerUserId };
  const calendar = new TestCalendarScheduleCreator();
  const policy = new CleaningLifecyclePolicy();
  const clock = new FixedClock();
  const scheduleCleaning = new ScheduleCleaning(
    unitOfWork,
    cleanings,
    calendar,
    policy,
    clock,
  );
  const rescheduleCleaning = new RescheduleCleaning(
    unitOfWork,
    cleanings,
    calendar,
    policy,
  );
  return {
    unitOfWork,
    cleanings,
    calendar,
    scheduleCleaning,
    rescheduleCleaning,
  };
}

test('ScheduleCleaning creates CalendarEntry v1 and increments only Cleaning relationship/version', async () => {
  const state = setup();
  const result = await state.scheduleCleaning.execute(owner, 'cleaning-1', {
    schedule: initialSchedule,
    expectedCleaningVersion: 1,
  });
  assert.equal(result.status, 'planned');
  assert.equal(result.version, 2);
  assert.equal(result.updatedAt.toISOString(), now.toISOString());
  assert.equal(result.calendarEntryId, 'calendar-1');
  assert.equal(state.calendar.entries.get('calendar-1')?.version, 1);
  assert.equal(
    state.calendar.entries.get('calendar-1')?.ownerUserId,
    owner.userId,
  );
  assert.equal(state.unitOfWork.calls, 1);
  assert.equal(state.cleanings.associateCalls, 1);
});

test('ScheduleCleaning conceals missing and non-owned Cleanings', async () => {
  const nonOwner = setup(undefined, 'other-user');
  await assert.rejects(
    nonOwner.scheduleCleaning.execute(owner, 'cleaning-1', {
      schedule: initialSchedule,
      expectedCleaningVersion: 1,
    }),
    CleaningNotFoundError,
  );
  nonOwner.cleanings.record = undefined;
  await assert.rejects(
    nonOwner.scheduleCleaning.execute(owner, 'missing', {
      schedule: initialSchedule,
      expectedCleaningVersion: 1,
    }),
    CleaningNotFoundError,
  );
  assert.equal(nonOwner.calendar.creates, 0);
});

test('ScheduleCleaning rejects invalid state, an existing CalendarEntry, and stale version', async () => {
  const inProgress = setup(
    Cleaning.createInitial('cleaning-1', 'order-1', now).start(now),
  );
  await assert.rejects(
    inProgress.scheduleCleaning.execute(owner, 'cleaning-1', {
      schedule: initialSchedule,
      expectedCleaningVersion: 2,
    }),
    CleaningSchedulingConflictError,
  );
  const alreadyScheduled = setup(
    Cleaning.createInitial('cleaning-1', 'order-1', now).withCalendarEntry(
      'calendar-existing',
    ),
  );
  await assert.rejects(
    alreadyScheduled.scheduleCleaning.execute(owner, 'cleaning-1', {
      schedule: initialSchedule,
      expectedCleaningVersion: 1,
    }),
    CleaningSchedulingConflictError,
  );
  const stale = setup();
  await assert.rejects(
    stale.scheduleCleaning.execute(owner, 'cleaning-1', {
      schedule: initialSchedule,
      expectedCleaningVersion: 5,
    }),
    CleaningVersionConflictError,
  );
  assert.equal(stale.calendar.creates, 0);
});

test('ScheduleCleaning rejects an invalid interval before opening UnitOfWork', async () => {
  const state = setup();
  await assert.rejects(
    state.scheduleCleaning.execute(owner, 'cleaning-1', {
      schedule: {
        startAt: initialSchedule.endAt,
        endAt: initialSchedule.startAt,
      },
      expectedCleaningVersion: 1,
    }),
    InvalidCalendarScheduleError,
  );
  assert.equal(state.unitOfWork.calls, 0);
});

test('ScheduleCleaning returns conflict when version-checked relationship update fails', async () => {
  const state = setup();
  state.cleanings.failAssociate = true;
  await assert.rejects(
    state.scheduleCleaning.execute(owner, 'cleaning-1', {
      schedule: initialSchedule,
      expectedCleaningVersion: 1,
    }),
    CleaningVersionConflictError,
  );
  assert.equal(state.unitOfWork.calls, 1);
  assert.equal(state.cleanings.record?.cleaning.calendarEntryId, null);
});

test('RescheduleCleaning preserves CalendarEntry identity and Cleaning version', async () => {
  const state = setup();
  const initiallyScheduled = await state.scheduleCleaning.execute(
    owner,
    'cleaning-1',
    { schedule: initialSchedule, expectedCleaningVersion: 1 },
  );
  const entryId = initiallyScheduled.calendarEntryId;
  const result = await state.rescheduleCleaning.execute(owner, 'cleaning-1', {
    schedule: nextSchedule,
    expectedCleaningVersion: initiallyScheduled.version,
    expectedCalendarEntryVersion: 1,
  });
  const entry = state.calendar.entries.get(entryId!);
  assert.equal(result.version, initiallyScheduled.version);
  assert.equal(result.calendarEntryId, entryId);
  assert.equal(entry?.id, entryId);
  assert.equal(entry?.version, 2);
  assert.equal(entry?.startAt, nextSchedule.startAt);
  assert.equal(entry?.endAt, nextSchedule.endAt);
  assert.equal(state.cleanings.associateCalls, 1);
});

test('RescheduleCleaning rejects missing/non-owned, stale, unscheduled, and invalid Calendar state', async () => {
  const nonOwner = setup(
    Cleaning.createInitial('cleaning-1', 'order-1', now).withCalendarEntry(
      'calendar-1',
    ),
    'other-user',
  );
  await assert.rejects(
    nonOwner.rescheduleCleaning.execute(owner, 'cleaning-1', {
      schedule: nextSchedule,
      expectedCleaningVersion: 1,
      expectedCalendarEntryVersion: 1,
    }),
    CleaningNotFoundError,
  );

  const unscheduled = setup();
  await assert.rejects(
    unscheduled.rescheduleCleaning.execute(owner, 'cleaning-1', {
      schedule: nextSchedule,
      expectedCleaningVersion: 1,
      expectedCalendarEntryVersion: 1,
    }),
    CleaningSchedulingConflictError,
  );

  const state = setup(
    Cleaning.createInitial('cleaning-1', 'order-1', now).withCalendarEntry(
      'calendar-1',
    ),
  );
  state.calendar.entries.set(
    'calendar-1',
    CalendarEntry.createScheduled(
      'calendar-1',
      owner.userId,
      initialSchedule,
      'Cleaning',
      now,
    ),
  );
  const command = {
    schedule: nextSchedule,
    expectedCleaningVersion: 1,
    expectedCalendarEntryVersion: 2,
  };
  await assert.rejects(
    state.rescheduleCleaning.execute(owner, 'cleaning-1', command),
    CleaningSchedulingConflictError,
  );
  await assert.rejects(
    state.rescheduleCleaning.execute(owner, 'cleaning-1', {
      ...command,
      expectedCleaningVersion: 3,
      expectedCalendarEntryVersion: 1,
    }),
    CleaningVersionConflictError,
  );
  assert.equal(state.calendar.entries.get('calendar-1')?.version, 1);

  const missingEntry = setup(
    Cleaning.createInitial('cleaning-1', 'order-1', now).withCalendarEntry(
      'calendar-missing',
    ),
  );
  await assert.rejects(
    missingEntry.rescheduleCleaning.execute(owner, 'cleaning-1', {
      schedule: nextSchedule,
      expectedCleaningVersion: 1,
      expectedCalendarEntryVersion: 1,
    }),
    CleaningSchedulingConflictError,
  );

  const terminalEntry = setup(
    Cleaning.createInitial('cleaning-1', 'order-1', now).withCalendarEntry(
      'calendar-terminal',
    ),
  );
  terminalEntry.calendar.entries.set(
    'calendar-terminal',
    CalendarEntry.reconstitute({
      id: 'calendar-terminal',
      ownerUserId: owner.userId,
      startAt: initialSchedule.startAt,
      endAt: initialSchedule.endAt,
      type: 'external_order',
      status: 'cancelled',
      title: 'Cleaning',
      createdAt: now,
      updatedAt: now,
      version: 1,
    }),
  );
  await assert.rejects(
    terminalEntry.rescheduleCleaning.execute(owner, 'cleaning-1', {
      schedule: nextSchedule,
      expectedCleaningVersion: 1,
      expectedCalendarEntryVersion: 1,
    }),
    CleaningSchedulingConflictError,
  );
});

test('RescheduleCleaning rejects invalid interval', async () => {
  const scheduled = setup(
    Cleaning.createInitial('cleaning-1', 'order-1', now).withCalendarEntry(
      'calendar-1',
    ),
  );
  scheduled.calendar.entries.set(
    'calendar-1',
    CalendarEntry.createScheduled(
      'calendar-1',
      owner.userId,
      initialSchedule,
      'Cleaning',
      now,
    ),
  );
  await assert.rejects(
    scheduled.rescheduleCleaning.execute(owner, 'cleaning-1', {
      schedule: { startAt: nextSchedule.endAt, endAt: nextSchedule.startAt },
      expectedCleaningVersion: 1,
      expectedCalendarEntryVersion: 1,
    }),
    InvalidCalendarScheduleError,
  );
});
