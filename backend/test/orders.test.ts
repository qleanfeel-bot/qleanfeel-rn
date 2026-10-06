import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthenticatedPrincipal } from '../src/application/identity/authenticated-principal.js';
import {
  Clock,
  IdentifierGenerator,
} from '../src/application/identity/ports/credential-services.js';
import { CreateManualOrder } from '../src/application/orders/create-manual-order.js';
import { CreateManualOrderPolicy } from '../src/application/orders/create-manual-order-policy.js';
import { CreateOrderCalendarEntry } from '../src/application/calendar/create-order-calendar-entry.js';
import { CalendarEntryRepository } from '../src/application/calendar/ports/calendar-entry-repository.js';
import {
  CleaningRepository,
  OrderRepository,
  OrderTermsRepository,
} from '../src/application/orders/ports/order-repositories.js';
import type { UnitOfWorkContext } from '../src/application/ports/unit-of-work.js';
import { UnitOfWork } from '../src/application/ports/unit-of-work.js';
import {
  assertValidSchedule,
  CalendarEntry,
  InvalidCalendarScheduleError,
} from '../src/domain/calendar/calendar-entry.js';
import {
  Cleaning,
  CLEANING_STATUSES,
} from '../src/domain/cleanings/cleaning.js';
import { OrderTerms } from '../src/domain/orders/order-terms.js';
import {
  Order,
  ORDER_ORIGINS,
  ORDER_STATUSES,
} from '../src/domain/orders/order.js';

const now = new Date('2026-10-06T09:30:00.000Z');
const principal: AuthenticatedPrincipal = {
  userId: 'trusted-user',
  sessionId: 'trusted-session',
};
const termsInput = {
  customerName: 'Customer Name',
  customerPhone: '+15550000000',
  serviceDescription: 'Home cleaning',
  serviceAddress: '10 Main Street',
  quotedPrice: { amountMinor: 12500, currencyCode: 'USD' },
  notes: 'Please call on arrival',
};

class TestClock extends Clock {
  now() {
    return now;
  }
}

class TestIdentifiers extends IdentifierGenerator {
  private count = 0;
  next() {
    this.count += 1;
    return `id-${this.count}`;
  }
}

class TestUnitOfWork extends UnitOfWork {
  calls = 0;
  async execute<T>(operation: (context: UnitOfWorkContext) => Promise<T>) {
    this.calls += 1;
    return operation({} as UnitOfWorkContext);
  }
}

class TestOrderRepository extends OrderRepository {
  values: Order[] = [];
  async create(value: Order) {
    this.values.push(value);
  }
}

class TestTermsRepository extends OrderTermsRepository {
  values: OrderTerms[] = [];
  async create(value: OrderTerms) {
    this.values.push(value);
  }
}

class TestCleaningRepository extends CleaningRepository {
  values: Cleaning[] = [];
  async create(value: Cleaning) {
    this.values.push(value);
  }
  async associateCalendarEntry(value: Cleaning) {
    this.values[this.values.length - 1] = value;
  }
}

class TestCalendarRepository extends CalendarEntryRepository {
  values: CalendarEntry[] = [];
  fail = false;
  async create(value: CalendarEntry) {
    if (this.fail) throw new Error('calendar write failed');
    this.values.push(value);
  }
}

function setup() {
  const unitOfWork = new TestUnitOfWork();
  const orders = new TestOrderRepository();
  const terms = new TestTermsRepository();
  const cleanings = new TestCleaningRepository();
  const calendar = new TestCalendarRepository();
  const identifiers = new TestIdentifiers();
  const clock = new TestClock();
  const useCase = new CreateManualOrder(
    unitOfWork,
    orders,
    terms,
    cleanings,
    new CreateOrderCalendarEntry(calendar, identifiers, clock),
    new CreateManualOrderPolicy(),
    identifiers,
    clock,
  );
  return { unitOfWork, orders, terms, cleanings, calendar, useCase };
}

test('Order creation sets server-owned manual origin, confirmed status, timestamps and initial version', () => {
  const order = Order.createManual('order-1', principal.userId, now);
  assert.equal(order.origin, ORDER_ORIGINS.MANUAL);
  assert.equal(order.createdByUserId, principal.userId);
  assert.equal(order.status, ORDER_STATUSES.CONFIRMED);
  assert.equal(order.version, 1);
  assert.deepEqual(order.createdAt, now);
  assert.deepEqual(order.updatedAt, now);
});

test('OrderTerms validates and snapshots a quote in integer minor units', () => {
  const terms = OrderTerms.createInitial('terms-1', 'order-1', termsInput, now);
  assert.equal(terms.revision, 1);
  assert.deepEqual(terms.quotedPrice, {
    amountMinor: 12500,
    currencyCode: 'USD',
  });
  assert.throws(() =>
    OrderTerms.createInitial(
      'terms-2',
      'order-1',
      {
        ...termsInput,
        quotedPrice: { amountMinor: 1.5, currencyCode: 'USD' },
      },
      now,
    ),
  );
});

test('initial Cleaning is planned, belongs to its Order and starts at version one', () => {
  const cleaning = Cleaning.createInitial('cleaning-1', 'order-1', now);
  assert.equal(cleaning.orderId, 'order-1');
  assert.equal(cleaning.status, CLEANING_STATUSES.PLANNED);
  assert.equal(cleaning.calendarEntryId, null);
  assert.equal(cleaning.version, 1);
});

test('schedule accepts canonical UTC intervals and rejects invalid or non-UTC values', () => {
  assert.doesNotThrow(() =>
    assertValidSchedule({
      startAt: '2026-10-06T10:00:00.000Z',
      endAt: '2026-10-06T11:00:00.000Z',
    }),
  );
  for (const schedule of [
    { startAt: '2026-10-06T11:00:00.000Z', endAt: '2026-10-06T10:00:00.000Z' },
    { startAt: '2026-02-30T10:00:00.000Z', endAt: '2026-10-06T11:00:00.000Z' },
    { startAt: '2026-10-06T10:00:00+00:00', endAt: '2026-10-06T11:00:00Z' },
  ]) {
    assert.throws(
      () => assertValidSchedule(schedule),
      InvalidCalendarScheduleError,
    );
  }
});

test('CreateManualOrder persists terms and exactly one unscheduled Cleaning atomically', async () => {
  const state = setup();
  const result = await state.useCase.execute(principal, { terms: termsInput });
  assert.equal(state.unitOfWork.calls, 1);
  assert.equal(state.orders.values.length, 1);
  assert.equal(state.terms.values.length, 1);
  assert.equal(state.cleanings.values.length, 1);
  assert.equal(state.calendar.values.length, 0);
  assert.equal(result.order.createdByUserId, principal.userId);
  assert.equal(result.order.origin, 'manual');
  assert.equal(result.cleaning.calendarEntryId, null);
  assert.equal(result.calendarEntry, undefined);
});

test('CreateManualOrder writes one CalendarEntry and links it to the initial Cleaning', async () => {
  const state = setup();
  const result = await state.useCase.execute(principal, {
    terms: termsInput,
    schedule: {
      startAt: '2026-10-06T10:00:00.000Z',
      endAt: '2026-10-06T11:00:00.000Z',
    },
  });
  assert.equal(state.orders.values.length, 1);
  assert.equal(state.terms.values.length, 1);
  assert.equal(state.cleanings.values.length, 1);
  assert.equal(state.calendar.values.length, 1);
  assert.equal(result.calendarEntry?.ownerUserId, principal.userId);
  assert.equal(result.cleaning.calendarEntryId, result.calendarEntry?.id);
});

test('CreateManualOrder lets Calendar persistence failure escape the single UnitOfWork', async () => {
  const state = setup();
  state.calendar.fail = true;
  await assert.rejects(
    state.useCase.execute(principal, {
      terms: termsInput,
      schedule: {
        startAt: '2026-10-06T10:00:00.000Z',
        endAt: '2026-10-06T11:00:00.000Z',
      },
    }),
    /calendar write failed/,
  );
  assert.equal(state.unitOfWork.calls, 1);
  assert.equal(state.orders.values.length, 1);
  assert.equal(state.terms.values.length, 1);
  assert.equal(state.cleanings.values.length, 1);
});

test('invalid schedule is rejected before opening the UnitOfWork or writing records', async () => {
  const state = setup();
  await assert.rejects(
    state.useCase.execute(principal, {
      terms: termsInput,
      schedule: {
        startAt: '2026-10-06T11:00:00.000Z',
        endAt: '2026-10-06T10:00:00.000Z',
      },
    }),
  );
  assert.equal(state.unitOfWork.calls, 0);
  assert.equal(state.orders.values.length, 0);
  assert.equal(state.terms.values.length, 0);
  assert.equal(state.cleanings.values.length, 0);
  assert.equal(state.calendar.values.length, 0);
});
