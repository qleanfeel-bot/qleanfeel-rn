import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Cleaning,
  CLEANING_STATUSES,
  InvalidCleaningTransitionError,
} from '../src/domain/cleanings/cleaning.js';
import {
  CleaningLifecycleEvent,
  CLEANING_LIFECYCLE_EVENT_TYPES,
} from '../src/domain/cleanings/cleaning-lifecycle-event.js';

const createdAt = new Date('2026-10-08T09:00:00.000Z');
const startedAt = new Date('2026-10-08T09:30:00.000Z');
const endedAt = new Date('2026-10-08T10:45:00.000Z');

function planned(): Cleaning {
  return Cleaning.createInitial('cleaning-1', 'order-1', createdAt);
}

function inProgress(): Cleaning {
  return planned().start(startedAt);
}

test('planned Cleaning can start with server timestamp and incremented version', () => {
  const initial = planned();
  const next = initial.start(startedAt);
  assert.equal(initial.status, CLEANING_STATUSES.PLANNED);
  assert.equal(initial.version, 1);
  assert.equal(next.status, CLEANING_STATUSES.IN_PROGRESS);
  assert.deepEqual(next.startedAt, startedAt);
  assert.equal(next.completedAt, null);
  assert.deepEqual(next.updatedAt, startedAt);
  assert.equal(next.version, 2);
});

test('planned Cleaning can be cancelled without a work-completion timestamp', () => {
  const next = planned().cancel(endedAt);
  assert.equal(next.status, CLEANING_STATUSES.CANCELLED);
  assert.equal(next.startedAt, null);
  assert.equal(next.completedAt, null);
  assert.deepEqual(next.updatedAt, endedAt);
  assert.equal(next.version, 2);
});

test('planned Cleaning can be marked not performed and records the terminal time', () => {
  const next = planned().markNotPerformed(endedAt);
  assert.equal(next.status, CLEANING_STATUSES.NOT_PERFORMED);
  assert.equal(next.startedAt, null);
  assert.deepEqual(next.completedAt, endedAt);
  assert.equal(next.version, 2);
});

test('in-progress Cleaning can complete and preserves start time', () => {
  const next = inProgress().complete(endedAt);
  assert.equal(next.status, CLEANING_STATUSES.COMPLETED);
  assert.deepEqual(next.startedAt, startedAt);
  assert.deepEqual(next.completedAt, endedAt);
  assert.equal(next.version, 3);
});

test('in-progress Cleaning can be partially completed and preserves start time', () => {
  const next = inProgress().partiallyComplete(endedAt);
  assert.equal(next.status, CLEANING_STATUSES.PARTIALLY_COMPLETED);
  assert.deepEqual(next.startedAt, startedAt);
  assert.deepEqual(next.completedAt, endedAt);
  assert.equal(next.version, 3);
});

test('in-progress Cleaning can be marked not performed with its start time retained', () => {
  const next = inProgress().markNotPerformed(endedAt);
  assert.equal(next.status, CLEANING_STATUSES.NOT_PERFORMED);
  assert.deepEqual(next.startedAt, startedAt);
  assert.deepEqual(next.completedAt, endedAt);
  assert.equal(next.version, 3);
});

test('invalid nonterminal transitions fail deterministically', () => {
  assert.throws(
    () => planned().complete(endedAt),
    InvalidCleaningTransitionError,
  );
  assert.throws(
    () => planned().partiallyComplete(endedAt),
    InvalidCleaningTransitionError,
  );
  assert.throws(
    () => inProgress().start(endedAt),
    InvalidCleaningTransitionError,
  );
  assert.throws(
    () => inProgress().cancel(endedAt),
    InvalidCleaningTransitionError,
  );
});

test('every terminal state rejects all ordinary reverse transitions', () => {
  const terminalStates = [
    planned().cancel(endedAt),
    planned().markNotPerformed(endedAt),
    inProgress().complete(endedAt),
    inProgress().partiallyComplete(endedAt),
  ];
  for (const terminal of terminalStates) {
    for (const transition of [
      (cleaning: Cleaning) => cleaning.start(endedAt),
      (cleaning: Cleaning) => cleaning.complete(endedAt),
      (cleaning: Cleaning) => cleaning.partiallyComplete(endedAt),
      (cleaning: Cleaning) => cleaning.cancel(endedAt),
      (cleaning: Cleaning) => cleaning.markNotPerformed(endedAt),
    ]) {
      assert.throws(() => transition(terminal), InvalidCleaningTransitionError);
    }
  }
});

test('CleaningLifecycleEvent records an immutable transition fact and version', () => {
  const event = CleaningLifecycleEvent.record(
    'event-2',
    'cleaning-1',
    CLEANING_LIFECYCLE_EVENT_TYPES.STARTED,
    'user-1',
    startedAt,
    startedAt,
    2,
  );
  assert.equal(event.eventType, 'started');
  assert.equal(event.version, 2);
  assert.deepEqual(event.occurredAt, startedAt);
  assert.deepEqual(event.recordedAt, startedAt);
});
