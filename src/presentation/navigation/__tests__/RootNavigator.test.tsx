import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import PagerView from 'react-native-pager-view';
import { CalendarService } from '../../../application/calendar/CalendarService';
import { CreateScheduledManualOrder } from '../../../application/manualOrder/CreateScheduledManualOrder';
import { ManualOrderService } from '../../../application/manualOrder/ManualOrderService';
import { ProfileService } from '../../../application/profile/ProfileService';
import type { CalendarEntry } from '../../../domain/calendar/entities/CalendarEntry';
import type { CalendarRepository } from '../../../domain/calendar/repositories/CalendarRepository';
import type { ManualOrder } from '../../../domain/manualOrder/entities/ManualOrder';
import type { ManualOrderRepository } from '../../../domain/manualOrder/repositories/ManualOrderRepository';
import type { ProfileRepository } from '../../../domain/profile/repositories/ProfileRepository';
import { RootNavigator } from '../RootNavigator';

const now = new Date();
const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0, 0);
const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
const dateKey = `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const mountedRenderers: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  ReactTestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

const appointment: CalendarEntry = {
  id: 'calendar-1',
  startAt: start.toISOString(),
  endAt: end.toISOString(),
  type: 'external_order',
  status: 'scheduled',
  title: 'Apartment cleaning',
};

const order: ManualOrder = {
  id: 'order-1',
  customerName: 'Ivan',
  serviceDescription: 'Apartment cleaning',
  serviceAddress: 'Nevsky 25',
  calendarEntryId: appointment.id,
  createdAt: '2026-10-01T09:00:00.000Z',
  customerPhone: null,
  quotedPrice: null,
  notes: null,
};

function dependencies() {
  const entries = [appointment];
  const orders = [order];
  let nextCalendarId = 1;
  let nextOrderId = 1;
  const calendarRepository: jest.Mocked<CalendarRepository> = {
    getEntries: jest.fn(async (_from: string, _to: string) => [...entries]),
    getEntry: jest.fn(async entryId => {
      const found = entries.find(candidate => candidate.id === entryId);
      if (!found) {
        throw new Error('calendar entry not found');
      }
      return found;
    }),
    createEntry: jest.fn(async input => {
      const created: CalendarEntry = {
        ...input,
        id: `calendar-created-${nextCalendarId++}`,
        status: 'scheduled',
      };
      entries.push(created);
      return created;
    }),
    updateEntry: jest.fn(async (entryId, changes) => {
      const existing = entries.find(candidate => candidate.id === entryId);
      if (!existing) {
        throw new Error('calendar entry not found');
      }
      const updated = { ...existing, ...changes };
      entries.splice(entries.indexOf(existing), 1, updated);
      return updated;
    }),
    deleteEntry: jest.fn(async entryId => {
      const index = entries.findIndex(candidate => candidate.id === entryId);
      if (index >= 0) {
        entries.splice(index, 1);
      }
    }),
  };
  const manualOrderRepository: jest.Mocked<ManualOrderRepository> = {
    getOrders: jest.fn(async () => [...orders]),
    getOrder: jest.fn(async orderId => {
      const found = orders.find(candidate => candidate.id === orderId);
      if (!found) {
        throw new Error('manual order not found');
      }
      return found;
    }),
    createOrder: jest.fn(async input => {
      const created: ManualOrder = {
        ...input,
        id: `order-created-${nextOrderId++}`,
        createdAt: new Date().toISOString(),
        customerPhone: input.customerPhone ?? null,
        quotedPrice: input.quotedPrice ?? null,
        notes: input.notes ?? null,
      };
      orders.push(created);
      return created;
    }),
  };
  const profileRepository: ProfileRepository = {
    getProfile: jest.fn().mockResolvedValue({
      userId: 'user-1', displayName: 'Pavel', phone: null, email: null,
      avatar: null, locale: null, country: null,
    }),
    updateDisplayName: jest.fn(),
  };
  const calendarService = new CalendarService(calendarRepository);
  const manualOrderService = new ManualOrderService(manualOrderRepository);
  return {
    calendarService,
    manualOrderService,
    createScheduledManualOrder: new CreateScheduledManualOrder(calendarService, manualOrderService),
    profileService: new ProfileService(profileRepository),
    calendarRepository,
    manualOrderRepository,
  };
}

async function renderNavigator() {
  const services = dependencies();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <RootNavigator
        accountStatus="active"
        calendarService={services.calendarService}
        createScheduledManualOrder={services.createScheduledManualOrder}
        manualOrderService={services.manualOrderService}
        onLogout={jest.fn()}
        profileService={services.profileService}
        userId="user-1"
      />,
    );
  });
  mountedRenderers.push(renderer);
  return { renderer, ...services };
}

function get(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return renderer.root.findByProps({ testID });
}

function textFor(renderer: ReactTestRenderer.ReactTestRenderer, testID: string): string {
  return get(renderer, testID).props.value as string;
}

async function press(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  await ReactTestRenderer.act(async () => {
    await get(renderer, testID).props.onPress();
  });
}

async function enterText(renderer: ReactTestRenderer.ReactTestRenderer, testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    get(renderer, testID).props.onChangeText(value);
  });
}

describe('RootNavigator', () => {
  it('opens Calendar day summary and the shared Order Details from a scheduled order', async () => {
    const { renderer, calendarRepository, manualOrderRepository } = await renderNavigator();
    await press(renderer, 'root-tab-calendar');

    expect(get(renderer, `calendar-day-${dateKey}`)).toBeTruthy();
    await press(renderer, `calendar-day-${dateKey}`);
    expect(get(renderer, 'day-summary-screen')).toBeTruthy();
    expect(get(renderer, `day-summary-order-${order.id}`)).toBeTruthy();
    await press(renderer, `day-summary-order-${order.id}`);

    expect(get(renderer, 'manual-order-details-loaded')).toBeTruthy();
    expect(manualOrderRepository.getOrder).toHaveBeenCalledWith(order.id);
    expect(calendarRepository.getEntry).toHaveBeenCalledWith(appointment.id);
    expect(textFor(renderer, 'manual-order-details-date')).toContain(new Date(appointment.startAt).toLocaleDateString());
    expect(textFor(renderer, 'manual-order-details-start')).toContain(new Date(appointment.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    expect(textFor(renderer, 'manual-order-details-end')).toContain(new Date(appointment.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  });

  it('opens the same Order Details screen from the Orders list', async () => {
    const { renderer, manualOrderRepository } = await renderNavigator();
    await press(renderer, 'root-tab-orders');
    expect(get(renderer, `manual-order-${order.id}`)).toBeTruthy();
    await press(renderer, `manual-order-${order.id}`);

    expect(get(renderer, 'manual-order-details-loaded')).toBeTruthy();
    expect(manualOrderRepository.getOrder).toHaveBeenCalledWith(order.id);
  });

  it('opens Order Details directly from the Calendar week record', async () => {
    const { renderer, manualOrderRepository } = await renderNavigator();
    await press(renderer, 'root-tab-calendar');
    await press(renderer, `calendar-open-order-${order.id}`);

    expect(get(renderer, 'manual-order-details-loaded')).toBeTruthy();
    expect(manualOrderRepository.getOrder).toHaveBeenCalledWith(order.id);
  });

  it('creates a linked ManualOrder from Calendar Add Entry and opens the shared Order Details', async () => {
    const { renderer, calendarRepository, manualOrderRepository } = await renderNavigator();
    await press(renderer, 'root-tab-calendar');
    await press(renderer, 'calendar-create-button');
    await press(renderer, 'calendar-type-external_order');
    await enterText(renderer, 'calendar-order-customer-input', 'Mila');
    await enterText(renderer, 'calendar-title-input', 'Deep cleaning');
    await enterText(renderer, 'calendar-order-address-input', 'Nevsky 25');
    await press(renderer, 'calendar-save-button');

    const createdEntry = await calendarRepository.createEntry.mock.results[0].value;
    const createdOrder = await manualOrderRepository.createOrder.mock.results[0].value;
    expect(createdEntry.type).toBe('external_order');
    expect(createdEntry.title).toBe('Deep cleaning');
    expect(createdOrder).toMatchObject({
      customerName: 'Mila',
      serviceDescription: 'Deep cleaning',
      serviceAddress: 'Nevsky 25',
      calendarEntryId: createdEntry.id,
    });
    expect(get(renderer, `calendar-open-order-${createdOrder.id}`)).toBeTruthy();

    await press(renderer, `calendar-open-order-${createdOrder.id}`);
    expect(get(renderer, 'manual-order-details-loaded')).toBeTruthy();
    expect(manualOrderRepository.getOrder).toHaveBeenCalledWith(createdOrder.id);
    expect(calendarRepository.getEntry).toHaveBeenCalledWith(createdEntry.id);
  });

  it('preserves Orders Add Order creation and details navigation', async () => {
    const { renderer, manualOrderRepository, calendarRepository } = await renderNavigator();
    await press(renderer, 'root-tab-orders');
    await press(renderer, 'manual-orders-add-button');
    await enterText(renderer, 'manual-order-customer-input', 'Nina');
    await enterText(renderer, 'manual-order-service-input', 'Window cleaning');
    await enterText(renderer, 'manual-order-address-input', 'Liteyny 8');
    await press(renderer, 'manual-order-save-button');

    const createdOrder = await manualOrderRepository.createOrder.mock.results[0].value;
    expect(createdOrder.calendarEntryId).toBeTruthy();
    expect(get(renderer, `manual-order-${createdOrder.id}`)).toBeTruthy();
    await press(renderer, `manual-order-${createdOrder.id}`);
    expect(get(renderer, 'manual-order-details-loaded')).toBeTruthy();
    expect(calendarRepository.getEntry).toHaveBeenCalledWith(createdOrder.calendarEntryId);
  });

  it('keeps Orders add form in its stack and exposes the existing cancel path', async () => {
    const { renderer } = await renderNavigator();
    await press(renderer, 'root-tab-orders');
    await press(renderer, 'manual-orders-add-button');
    expect(get(renderer, 'manual-order-form')).toBeTruthy();
    expect(renderer.root.findAllByType(PagerView)[0].props.scrollEnabled).toBe(false);
    await press(renderer, 'manual-order-cancel-button');
    expect(get(renderer, 'manual-orders-screen')).toBeTruthy();
    expect(renderer.root.findAllByType(PagerView)[0].props.scrollEnabled).toBe(true);
  });

  it('keeps root surface controls available while a Calendar nested route is open', async () => {
    const { renderer } = await renderNavigator();
    await press(renderer, 'root-tab-calendar');
    await press(renderer, `calendar-day-${dateKey}`);
    expect(get(renderer, 'day-summary-screen')).toBeTruthy();
    await press(renderer, 'root-tab-profile');
    expect(get(renderer, 'profile-screen')).toBeTruthy();
    expect(get(renderer, 'root-tab-calendar')).toBeTruthy();
  });

  it('keeps root swipes on root surfaces and reserves Calendar swipes for week navigation', async () => {
    const { renderer } = await renderNavigator();
    let pagers = renderer.root.findAllByType(PagerView);
    expect(pagers[0].props.scrollEnabled).toBe(true);

    await press(renderer, 'root-tab-orders');
    pagers = renderer.root.findAllByType(PagerView);
    expect(pagers[0].props.scrollEnabled).toBe(true);

    await press(renderer, 'root-tab-calendar');
    pagers = renderer.root.findAllByType(PagerView);
    expect(pagers).toHaveLength(2);
    expect(pagers[0].props.scrollEnabled).toBe(false);
    expect(pagers[1].props.scrollEnabled).toBe(true);
    await press(renderer, `calendar-day-${dateKey}`);
    pagers = renderer.root.findAllByType(PagerView);
    expect(pagers[0].props.scrollEnabled).toBe(false);
    expect(pagers[1].props.scrollEnabled).toBe(true);
    await press(renderer, 'root-tab-profile');
    expect(get(renderer, 'profile-screen')).toBeTruthy();
  });
});
