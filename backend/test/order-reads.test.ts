import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthenticatedPrincipal } from '../src/application/identity/authenticated-principal.js';
import {
  GetMyOrder,
  MyOrderNotFoundError,
} from '../src/application/orders/get-my-order.js';
import {
  ListMyOrders,
  InvalidOrderListLimitError,
} from '../src/application/orders/list-my-orders.js';
import { OrderReadPolicy } from '../src/application/orders/order-read-policy.js';
import {
  OrderReadRepository,
  type OrderReadModel,
  type OrderReadPosition,
} from '../src/application/orders/ports/order-read-repository.js';

const userA: AuthenticatedPrincipal = {
  userId: 'user-a',
  sessionId: 'session-a',
};
const timestamp = new Date('2026-10-06T09:30:00.000Z');

function order(id: string, ownerUserId = userA.userId): OrderReadModel {
  return {
    id,
    ownerUserId,
    origin: 'manual',
    status: 'confirmed',
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    terms: {
      id: `terms-${id}`,
      revision: 2,
      customerName: 'Customer',
      customerPhone: null,
      serviceDescription: 'Cleaning',
      serviceAddress: '1 Main St',
      quotedPrice: null,
      notes: null,
      createdAt: timestamp,
    },
    cleanings: [
      {
        id: `cleaning-${id}-1`,
        status: 'planned',
        startedAt: null,
        completedAt: null,
        calendarEntry: null,
      },
      {
        id: `cleaning-${id}-2`,
        status: 'planned',
        startedAt: null,
        completedAt: null,
        calendarEntry: {
          id: `calendar-${id}`,
          startAt: timestamp,
          endAt: new Date(timestamp.getTime() + 3_600_000),
          type: 'external_order',
          status: 'scheduled',
          title: 'Appointment',
        },
      },
    ],
  };
}

class FakeReadRepository extends OrderReadRepository {
  values: readonly OrderReadModel[] = [];
  listCalls: { owner: string; before?: OrderReadPosition; take: number }[] = [];
  async listOwned(
    owner: string,
    before: OrderReadPosition | undefined,
    take: number,
  ) {
    this.listCalls.push({ owner, before, take });
    return this.values
      .filter(value => value.ownerUserId === owner)
      .slice(0, take);
  }
  async findById(id: string) {
    return this.values.find(value => value.id === id);
  }
}

test('ListMyOrders scopes by principal, requests one lookahead and returns cursor position', async () => {
  const repository = new FakeReadRepository();
  repository.values = [
    order('one'),
    order('two'),
    order('three'),
    order('foreign', 'user-b'),
  ];
  const result = await new ListMyOrders(repository).execute(userA, {
    limit: 2,
  });
  assert.deepEqual(
    result.items.map(item => item.id),
    ['one', 'two'],
  );
  assert.deepEqual(result.nextPosition, { createdAt: timestamp, id: 'two' });
  assert.deepEqual(repository.listCalls, [
    { owner: 'user-a', before: undefined, take: 3 },
  ]);
});

test('ListMyOrders supports empty results and cursor continuation', async () => {
  const repository = new FakeReadRepository();
  const empty = await new ListMyOrders(repository).execute(userA, {
    limit: 10,
  });
  assert.deepEqual(empty, { items: [] });
  repository.values = [order('three')];
  const position = { createdAt: timestamp, id: 'two' };
  const next = await new ListMyOrders(repository).execute(userA, {
    limit: 1,
    before: position,
  });
  assert.equal(next.items[0]?.id, 'three');
  assert.equal(next.nextPosition, undefined);
  assert.equal(repository.listCalls[1]?.before, position);
});

test('ListMyOrders rejects invalid limits before repository access', async () => {
  const repository = new FakeReadRepository();
  await assert.rejects(
    new ListMyOrders(repository).execute(userA, { limit: 101 }),
    InvalidOrderListLimitError,
  );
  assert.equal(repository.listCalls.length, 0);
});

test('GetMyOrder returns the current read representation for its owner', async () => {
  const repository = new FakeReadRepository();
  repository.values = [order('order-a')];
  const result = await new GetMyOrder(
    repository,
    new OrderReadPolicy(),
  ).execute(userA, 'order-a');
  assert.equal(result.terms?.revision, 2);
  assert.equal(result.cleanings.length, 2);
  assert.equal(result.cleanings[0]?.calendarEntry, null);
  assert.equal(result.cleanings[1]?.calendarEntry?.status, 'scheduled');
});

test('GetMyOrder conceals missing and non-owned orders with the same error', async () => {
  const repository = new FakeReadRepository();
  repository.values = [order('foreign-order', 'user-b')];
  const useCase = new GetMyOrder(repository, new OrderReadPolicy());
  await assert.rejects(
    useCase.execute(userA, 'foreign-order'),
    MyOrderNotFoundError,
  );
  await assert.rejects(
    useCase.execute(userA, 'missing-order'),
    MyOrderNotFoundError,
  );
});
