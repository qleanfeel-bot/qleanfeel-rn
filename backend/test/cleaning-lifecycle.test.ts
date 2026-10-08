import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthenticatedPrincipal } from '../src/application/identity/authenticated-principal.js';
import {
  Clock,
  IdentifierGenerator,
} from '../src/application/identity/ports/credential-services.js';
import { CancelCleaning } from '../src/application/cleanings/cancel-cleaning.js';
import { CompleteCleaning } from '../src/application/cleanings/complete-cleaning.js';
import {
  CleaningNotFoundError,
  CleaningVersionConflictError,
} from '../src/application/cleanings/cleaning-lifecycle-errors.js';
import {
  CLEANING_LIFECYCLE_OPERATIONS,
  CleaningLifecyclePolicy,
} from '../src/application/cleanings/cleaning-lifecycle-policy.js';
import { MarkCleaningNotPerformed } from '../src/application/cleanings/mark-cleaning-not-performed.js';
import { PartiallyCompleteCleaning } from '../src/application/cleanings/partially-complete-cleaning.js';
import { StartCleaning } from '../src/application/cleanings/start-cleaning.js';
import { CleaningLifecycleRepository } from '../src/application/cleanings/ports/cleaning-lifecycle-repository.js';
import type { UnitOfWorkContext } from '../src/application/ports/unit-of-work.js';
import { UnitOfWork } from '../src/application/ports/unit-of-work.js';
import { Cleaning } from '../src/domain/cleanings/cleaning.js';
import type { CleaningLifecycleEvent } from '../src/domain/cleanings/cleaning-lifecycle-event.js';

const actor: AuthenticatedPrincipal = {
  userId: 'owner-user',
  sessionId: 'owner-session',
};
const now = new Date('2026-10-08T11:00:00.000Z');

class FixedClock extends Clock {
  now() {
    return now;
  }
}

class TestIdentifiers extends IdentifierGenerator {
  private nextId = 0;
  next() {
    this.nextId += 1;
    return `event-${this.nextId}`;
  }
}

class TestUnitOfWork extends UnitOfWork {
  calls = 0;
  async execute<T>(operation: (context: UnitOfWorkContext) => Promise<T>) {
    this.calls += 1;
    return operation({} as UnitOfWorkContext);
  }
}

class TestLifecycleRepository extends CleaningLifecycleRepository {
  record: { cleaning: Cleaning; orderOwnerUserId: string } | undefined;
  events: CleaningLifecycleEvent[] = [];
  updateCalls = 0;
  failCompareAndSet = false;
  failEventAppend = false;

  async findForLifecycle() {
    return this.record;
  }

  async updateState(cleaning: Cleaning, expectedVersion: number) {
    this.updateCalls += 1;
    if (
      this.failCompareAndSet ||
      this.record?.cleaning.version !== expectedVersion
    ) {
      return false;
    }
    this.record = {
      cleaning,
      orderOwnerUserId: this.record.orderOwnerUserId,
    };
    return true;
  }

  async appendLifecycleEvent(event: CleaningLifecycleEvent) {
    if (this.failEventAppend) throw new Error('event write failed');
    this.events.push(event);
  }
}

function setup(
  cleaning = Cleaning.createInitial('cleaning-1', 'order-1', now),
  orderOwnerUserId = actor.userId,
) {
  const unitOfWork = new TestUnitOfWork();
  const repository = new TestLifecycleRepository();
  repository.record = { cleaning, orderOwnerUserId };
  const policy = new CleaningLifecyclePolicy();
  const identifiers = new TestIdentifiers();
  const clock = new FixedClock();
  return {
    unitOfWork,
    repository,
    commands: {
      start: new StartCleaning(
        unitOfWork,
        repository,
        policy,
        identifiers,
        clock,
      ),
      complete: new CompleteCleaning(
        unitOfWork,
        repository,
        policy,
        identifiers,
        clock,
      ),
      partiallyComplete: new PartiallyCompleteCleaning(
        unitOfWork,
        repository,
        policy,
        identifiers,
        clock,
      ),
      cancel: new CancelCleaning(
        unitOfWork,
        repository,
        policy,
        identifiers,
        clock,
      ),
      notPerformed: new MarkCleaningNotPerformed(
        unitOfWork,
        repository,
        policy,
        identifiers,
        clock,
      ),
    },
  };
}

test('Cleaning lifecycle policy permits only the loaded Order owner for explicit operations', () => {
  const policy = new CleaningLifecyclePolicy();
  for (const operation of Object.values(CLEANING_LIFECYCLE_OPERATIONS)) {
    assert.deepEqual(
      policy.evaluate(actor, operation, { orderOwnerUserId: actor.userId }),
      { outcome: 'permit' },
    );
    assert.deepEqual(
      policy.evaluate(actor, operation, { orderOwnerUserId: 'another-user' }),
      { outcome: 'deny' },
    );
  }
});

test('each explicit Cleaning command persists one state change and matching versioned event', async () => {
  const cases = [
    {
      name: 'start',
      initial: Cleaning.createInitial('cleaning-1', 'order-1', now),
      command: 'start' as const,
      status: 'in_progress',
      eventType: 'started',
      version: 2,
    },
    {
      name: 'complete',
      initial: Cleaning.createInitial('cleaning-1', 'order-1', now).start(now),
      command: 'complete' as const,
      status: 'completed',
      eventType: 'completed',
      version: 3,
    },
    {
      name: 'partial complete',
      initial: Cleaning.createInitial('cleaning-1', 'order-1', now).start(now),
      command: 'partiallyComplete' as const,
      status: 'partially_completed',
      eventType: 'partially_completed',
      version: 3,
    },
    {
      name: 'cancel',
      initial: Cleaning.createInitial('cleaning-1', 'order-1', now),
      command: 'cancel' as const,
      status: 'cancelled',
      eventType: 'cancelled',
      version: 2,
    },
    {
      name: 'not performed',
      initial: Cleaning.createInitial('cleaning-1', 'order-1', now),
      command: 'notPerformed' as const,
      status: 'not_performed',
      eventType: 'not_performed',
      version: 2,
    },
  ];

  for (const item of cases) {
    const state = setup(item.initial);
    const changed = await state.commands[item.command].execute(
      actor,
      'cleaning-1',
    );
    assert.equal(changed.status, item.status, item.name);
    assert.equal(changed.version, item.version, item.name);
    assert.equal(state.unitOfWork.calls, 1, item.name);
    assert.equal(state.repository.updateCalls, 1, item.name);
    assert.equal(state.repository.events.length, 1, item.name);
    assert.equal(
      state.repository.events[0]?.eventType,
      item.eventType,
      item.name,
    );
    assert.equal(state.repository.events[0]?.version, item.version, item.name);
    assert.equal(
      state.repository.events[0]?.actorUserId,
      actor.userId,
      item.name,
    );
  }
});

test('non-owner and missing Cleaning are concealed and do not write', async () => {
  const other: AuthenticatedPrincipal = {
    userId: 'other-user',
    sessionId: 'other-session',
  };
  const state = setup(undefined, actor.userId);
  await assert.rejects(
    state.commands.start.execute(other, 'cleaning-1'),
    CleaningNotFoundError,
  );
  assert.equal(state.repository.updateCalls, 0);
  assert.equal(state.repository.events.length, 0);

  state.repository.record = undefined;
  await assert.rejects(
    state.commands.start.execute(actor, 'missing'),
    CleaningNotFoundError,
  );
  assert.equal(state.repository.updateCalls, 0);
});

test('domain transition errors prevent persistence and lifecycle events', async () => {
  const state = setup();
  await assert.rejects(state.commands.complete.execute(actor, 'cleaning-1'));
  assert.equal(state.repository.updateCalls, 0);
  assert.equal(state.repository.events.length, 0);
});

test('failed optimistic compare-and-set becomes a conflict without an event', async () => {
  const state = setup();
  state.repository.failCompareAndSet = true;
  await assert.rejects(
    state.commands.start.execute(actor, 'cleaning-1'),
    CleaningVersionConflictError,
  );
  assert.equal(state.repository.events.length, 0);
});

test('lifecycle event persistence failure escapes the UnitOfWork operation', async () => {
  const state = setup();
  state.repository.failEventAppend = true;
  await assert.rejects(
    state.commands.start.execute(actor, 'cleaning-1'),
    /event write failed/,
  );
  assert.equal(state.unitOfWork.calls, 1);
  assert.equal(state.repository.updateCalls, 1);
});
