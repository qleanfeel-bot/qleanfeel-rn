import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { CalendarService } from '../../../application/calendar/CalendarService';
import { ManualOrderService } from '../../../application/manualOrder/ManualOrderService';
import { ProfileService } from '../../../application/profile/ProfileService';
import type { CalendarEntry } from '../../../domain/calendar/entities/CalendarEntry';
import type { CalendarRepository } from '../../../domain/calendar/repositories/CalendarRepository';
import type { ManualOrder } from '../../../domain/manualOrder/entities/ManualOrder';
import type { ManualOrderRepository } from '../../../domain/manualOrder/repositories/ManualOrderRepository';
import type { ProfileRepository } from '../../../domain/profile/repositories/ProfileRepository';
import { localDayRange } from '../../calendar/calendarDateUtils';
import { HomeScreen } from '../HomeScreen';

function dateIso(hour: number): string {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour).toISOString();
}

const appointment: CalendarEntry = {
  id: 'calendar-1', startAt: dateIso(10), endAt: dateIso(12), type: 'external_order',
  status: 'scheduled', title: 'Apartment cleaning',
};
const order: ManualOrder = {
  id: 'order-1', customerName: 'Ivan', serviceDescription: 'Apartment cleaning', serviceAddress: 'Nevsky 25',
  calendarEntryId: appointment.id, createdAt: '2026-10-01T09:00:00.000Z', customerPhone: null,
  quotedPrice: null, notes: null,
};

function services(entries: CalendarEntry[] = [appointment], orders: ManualOrder[] = [order]) {
  const calendarRepository: jest.Mocked<CalendarRepository> = {
    getEntries: jest.fn().mockResolvedValue(entries),
    getEntry: jest.fn(async (_entryId: string) => appointment),
    createEntry: jest.fn(async (_input: Parameters<CalendarRepository['createEntry']>[0]) => appointment),
    updateEntry: jest.fn(async (_entryId: string, _changes: Parameters<CalendarRepository['updateEntry']>[1]) => appointment),
    deleteEntry: jest.fn().mockResolvedValue(undefined),
  };
  const manualOrderRepository: jest.Mocked<ManualOrderRepository> = {
    getOrders: jest.fn().mockResolvedValue(orders),
    getOrder: jest.fn(async (_orderId: string) => order),
    createOrder: jest.fn(async (_input: Parameters<ManualOrderRepository['createOrder']>[0]) => order),
  };
  const profileRepository: jest.Mocked<ProfileRepository> = {
    getProfile: jest.fn().mockResolvedValue({
      userId: 'user-1', displayName: 'Pavel', phone: null, email: null,
      avatar: null, locale: null, country: null,
    }),
    updateDisplayName: jest.fn().mockResolvedValue({
      userId: 'user-1', displayName: 'Pavel', phone: null, email: null,
      avatar: null, locale: null, country: null,
    }),
  };
  return {
    calendarService: new CalendarService(calendarRepository),
    manualOrderService: new ManualOrderService(manualOrderRepository),
    profileService: new ProfileService(profileRepository),
    calendarRepository,
    manualOrderRepository,
    profileRepository,
  };
}

async function renderHome(deps: ReturnType<typeof services>, callbacks = {
  onOpenCalendar: jest.fn(), onOpenOrders: jest.fn(), onOpenOrder: jest.fn(),
}) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <HomeScreen
        calendarService={deps.calendarService}
        manualOrderService={deps.manualOrderService}
        profileService={deps.profileService}
        userId="user-1"
        onOpenCalendar={callbacks.onOpenCalendar}
        onOpenOrders={callbacks.onOpenOrders}
        onOpenOrder={callbacks.onOpenOrder}
      />,
    );
  });
  return { renderer, callbacks };
}

function get(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return renderer.root.findByProps({ testID });
}

async function press(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  await ReactTestRenderer.act(async () => get(renderer, testID).props.onPress());
}

describe('HomeScreen', () => {
  it('aggregates today’s scheduled order from CalendarEntry and ManualOrder services', async () => {
    const deps = services();
    const callbacks = { onOpenCalendar: jest.fn(), onOpenOrders: jest.fn(), onOpenOrder: jest.fn() };
    const { renderer } = await renderHome(deps, callbacks);
    const range = localDayRange(new Date());

    expect(deps.calendarRepository.getEntries).toHaveBeenCalledWith(range.from, range.to);
    expect(deps.manualOrderRepository.getOrders).toHaveBeenCalledTimes(1);
    expect(deps.profileRepository.getProfile).toHaveBeenCalledWith('user-1');
    expect(get(renderer, 'home-greeting').props.children).toBe('Hello, Pavel');
    expect(get(renderer, 'home-order-order-1')).toBeTruthy();
    await press(renderer, 'home-order-order-1');
    await press(renderer, 'home-open-calendar');
    await press(renderer, 'home-open-orders');
    expect(callbacks.onOpenOrder).toHaveBeenCalledWith(order.id);
    expect(callbacks.onOpenCalendar).toHaveBeenCalledTimes(1);
    expect(callbacks.onOpenOrders).toHaveBeenCalledTimes(1);
  });

  it('shows an empty day state when no orders are scheduled today', async () => {
    const deps = services([], []);
    const { renderer } = await renderHome(deps);
    expect(get(renderer, 'home-empty')).toBeTruthy();
  });

  it('shows safe error and retries today’s work loading', async () => {
    const deps = services();
    const repository = deps.calendarRepository;
    repository.getEntries.mockRejectedValueOnce(new Error('private storage detail')).mockResolvedValueOnce([appointment]);
    const { renderer } = await renderHome(deps);
    expect(get(renderer, 'home-error')).toBeTruthy();
    expect(JSON.stringify(renderer.toJSON())).not.toContain('private storage detail');
    await press(renderer, 'home-retry-button');
    expect(repository.getEntries).toHaveBeenCalledTimes(2);
    expect(get(renderer, 'home-order-order-1')).toBeTruthy();
  });
});
