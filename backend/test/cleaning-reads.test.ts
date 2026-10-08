import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthenticatedPrincipal } from '../src/application/identity/authenticated-principal.js';
import { CleaningNotFoundError } from '../src/application/cleanings/cleaning-lifecycle-errors.js';
import { GetMyCleaning } from '../src/application/cleanings/get-my-cleaning.js';
import { GetMyCleaningLifecycle } from '../src/application/cleanings/get-my-cleaning-lifecycle.js';
import {
  CLEANING_READ_OPERATIONS,
  CleaningReadPolicy,
} from '../src/application/cleanings/cleaning-read-policy.js';
import { CleaningReadRepository } from '../src/application/cleanings/ports/cleaning-read-repository.js';
import type { CleaningReadRecord } from '../src/application/cleanings/ports/cleaning-read-repository.js';
import { Cleaning } from '../src/domain/cleanings/cleaning.js';
import { CleaningLifecycleEvent } from '../src/domain/cleanings/cleaning-lifecycle-event.js';

const owner: AuthenticatedPrincipal = {
  userId: 'owner-user',
  sessionId: 'owner-session',
};
const at = new Date('2026-10-08T11:00:00.000Z');

class FakeCleaningReadRepository extends CleaningReadRepository {
  record: CleaningReadRecord | undefined;
  events: readonly CleaningLifecycleEvent[] = [];
  lifecycleReads = 0;

  async findById() {
    return this.record;
  }

  async findLifecycleEvents() {
    this.lifecycleReads += 1;
    return this.events;
  }
}

function setup(ownerUserId = owner.userId) {
  const repository = new FakeCleaningReadRepository();
  repository.record = {
    cleaning: Cleaning.createInitial('cleaning-1', 'order-1', at).start(at),
    orderOwnerUserId: ownerUserId,
  };
  const policy = new CleaningReadPolicy();
  return {
    repository,
    getCleaning: new GetMyCleaning(repository, policy),
    getLifecycle: new GetMyCleaningLifecycle(repository, policy),
    policy,
  };
}

test('Cleaning read policy allows both read operations only for the Order owner', () => {
  const { policy } = setup();
  for (const operation of Object.values(CLEANING_READ_OPERATIONS)) {
    assert.deepEqual(
      policy.evaluate(owner, operation, { orderOwnerUserId: owner.userId }),
      { outcome: 'permit' },
    );
    assert.deepEqual(
      policy.evaluate(owner, operation, { orderOwnerUserId: 'other-user' }),
      { outcome: 'deny' },
    );
  }
});

test('GetMyCleaning returns canonical current state with lifecycle fields and version', async () => {
  const { getCleaning, repository } = setup();
  repository.record = {
    cleaning: Cleaning.createInitial('cleaning-1', 'order-1', at)
      .start(at)
      .complete(new Date(at.getTime() + 60_000)),
    orderOwnerUserId: owner.userId,
  };
  const result = await getCleaning.execute(owner, 'cleaning-1');
  assert.equal(result.status, 'completed');
  assert.equal(result.version, 3);
  assert.equal(result.startedAt?.toISOString(), at.toISOString());
  assert.equal(
    result.completedAt?.toISOString(),
    new Date(at.getTime() + 60_000).toISOString(),
  );
  assert.equal(result.calendarEntryId, null);
});

test('Cleaning reads conceal both missing and non-owned resources', async () => {
  const { getCleaning, getLifecycle, repository } = setup('other-user');
  await assert.rejects(
    getCleaning.execute(owner, 'cleaning-1'),
    CleaningNotFoundError,
  );
  await assert.rejects(
    getLifecycle.execute(owner, 'cleaning-1'),
    CleaningNotFoundError,
  );
  repository.record = undefined;
  await assert.rejects(
    getCleaning.execute(owner, 'missing'),
    CleaningNotFoundError,
  );
  await assert.rejects(
    getLifecycle.execute(owner, 'missing'),
    CleaningNotFoundError,
  );
  assert.equal(repository.lifecycleReads, 0);
});

test('GetMyCleaningLifecycle returns stored history as a separate read', async () => {
  const { getLifecycle, repository } = setup();
  const started = CleaningLifecycleEvent.record(
    'event-1',
    'cleaning-1',
    'started',
    owner.userId,
    at,
    at,
    2,
  );
  const completedAt = new Date(at.getTime() + 60_000);
  const completed = CleaningLifecycleEvent.record(
    'event-2',
    'cleaning-1',
    'completed',
    owner.userId,
    completedAt,
    completedAt,
    3,
  );
  repository.events = [started, completed];
  const result = await getLifecycle.execute(owner, 'cleaning-1');
  assert.deepEqual(result, [started, completed]);
  assert.equal(repository.lifecycleReads, 1);
});
