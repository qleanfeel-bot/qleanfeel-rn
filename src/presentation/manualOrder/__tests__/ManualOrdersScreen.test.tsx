import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { CalendarService } from '../../../application/calendar/CalendarService';
import { ManualOrderService } from '../../../application/manualOrder/ManualOrderService';
import type { CreateScheduledManualOrder } from '../../../application/manualOrder/CreateScheduledManualOrder';
import type { CalendarEntry } from '../../../domain/calendar/entities/CalendarEntry';
import type { CalendarRepository } from '../../../domain/calendar/repositories/CalendarRepository';
import type { ManualOrder } from '../../../domain/manualOrder/entities/ManualOrder';
import type { ManualOrderRepository } from '../../../domain/manualOrder/repositories/ManualOrderRepository';
import { ManualOrderFormScreen, ManualOrdersScreen } from '../ManualOrdersScreen';
import { OrderDetailsScreen } from '../OrderDetailsScreen';

const order: ManualOrder = {
  id: 'order-1',
  customerName: 'Ivan',
  serviceDescription: 'Apartment cleaning',
  serviceAddress: 'Nevsky 25',
  calendarEntryId: 'entry-1',
  createdAt: '2026-10-01T10:00:00.000Z',
  customerPhone: '+7 900 000 00 00',
  quotedPrice: { amountMinor: 400000, currencyCode: 'RUB' },
  notes: 'Call on arrival',
};
const entry: CalendarEntry = {
  id: 'entry-1',
  startAt: '2030-04-03T07:00:00Z',
  endAt: '2030-04-03T09:00:00Z',
  type: 'external_order',
  status: 'scheduled',
  title: 'Apartment cleaning',
};

function setup(options?: { orders?: ManualOrder[]; failFirstList?: boolean }) {
  const getOrders = jest.fn();
  if (options?.failFirstList) {
    getOrders.mockRejectedValueOnce({ code: 'NetworkError' });
  }
  getOrders.mockResolvedValue(options?.orders ?? []);
  const orderRepository: jest.Mocked<ManualOrderRepository> = {
    getOrders,
    createOrder: jest.fn().mockResolvedValue(order),
    getOrder: jest.fn().mockResolvedValue(order),
  };
  const calendarRepository: jest.Mocked<CalendarRepository> = {
    getEntries: jest.fn().mockResolvedValue([]),
    getEntry: jest.fn().mockResolvedValue(entry),
    createEntry: jest.fn().mockResolvedValue(entry),
    updateEntry: jest.fn().mockResolvedValue(entry),
    deleteEntry: jest.fn().mockResolvedValue(undefined),
  };
  const manualOrderService = new ManualOrderService(orderRepository);
  const calendarService = new CalendarService(calendarRepository);
  const createScheduledManualOrder = {
    execute: jest.fn().mockResolvedValue(order),
  } as unknown as jest.Mocked<CreateScheduledManualOrder>;
  const onAddOrder = jest.fn();
  const onOpenOrder = jest.fn();
  return {
    manualOrderService,
    calendarService,
    createScheduledManualOrder,
    orderRepository,
    calendarRepository,
    onAddOrder,
    onOpenOrder,
  };
}

async function renderScreen(dependencies: ReturnType<typeof setup>) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ManualOrdersScreen
        calendarService={dependencies.calendarService}
        manualOrderService={dependencies.manualOrderService}
        onAddOrder={dependencies.onAddOrder}
        onOpenOrder={dependencies.onOpenOrder}
      />,
    );
  });
  return renderer;
}

async function renderForm(dependencies: ReturnType<typeof setup>) {
  const onSaved = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ManualOrderFormScreen
        createScheduledManualOrder={dependencies.createScheduledManualOrder}
        initialDate="2030-04-03"
        onCancel={jest.fn()}
        onSaved={onSaved}
      />,
    );
  });
  return { renderer, onSaved };
}

function control(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return renderer.root.findByProps({ testID });
}

async function press(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  await ReactTestRenderer.act(async () => {
    await control(renderer, testID).props.onPress();
  });
}

async function enter(renderer: ReactTestRenderer.ReactTestRenderer, testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    control(renderer, testID).props.onChangeText(value);
  });
}

describe('ManualOrdersScreen', () => {
  it('shows loading then empty states', async () => {
    const dependencies = setup();
    let resolveOrders: (orders: ManualOrder[]) => void = () => undefined;
    dependencies.orderRepository.getOrders
      .mockReset()
      .mockReturnValueOnce(new Promise(resolve => {
        resolveOrders = resolve;
      }))
      .mockResolvedValue([]);
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ManualOrdersScreen
          calendarService={dependencies.calendarService}
          manualOrderService={dependencies.manualOrderService}
          onAddOrder={dependencies.onAddOrder}
          onOpenOrder={dependencies.onOpenOrder}
        />,
      );
    });

    expect(control(renderer, 'manual-orders-loading')).toBeTruthy();
    await ReactTestRenderer.act(async () => {
      resolveOrders([]);
      await Promise.resolve();
    });
    expect(control(renderer, 'manual-orders-empty')).toBeTruthy();
  });

  it('shows an error and retries the Orders list', async () => {
    const dependencies = setup({ failFirstList: true });
    const renderer = await renderScreen(dependencies);
    expect(control(renderer, 'manual-orders-error')).toBeTruthy();

    await press(renderer, 'manual-orders-retry-button');

    expect(control(renderer, 'manual-orders-empty')).toBeTruthy();
    expect(dependencies.orderRepository.getOrders).toHaveBeenCalledTimes(2);
  });

  it('renders list items and requests the selected order route', async () => {
    const dependencies = setup({ orders: [order] });
    const renderer = await renderScreen(dependencies);

    expect(control(renderer, 'manual-order-order-1')).toBeTruthy();
    expect(JSON.stringify(renderer.toJSON())).toContain('Apartment cleaning');
    await press(renderer, 'manual-order-order-1');

    expect(dependencies.onOpenOrder).toHaveBeenCalledWith(order.id);
  });

  it('shows order details with date and times supplied by the linked CalendarEntry', async () => {
    const dependencies = setup();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <OrderDetailsScreen
          calendarService={dependencies.calendarService}
          manualOrderService={dependencies.manualOrderService}
          orderId={order.id}
        />,
      );
    });

    expect(dependencies.orderRepository.getOrder).toHaveBeenCalledWith(order.id);
    expect(dependencies.calendarRepository.getEntry).toHaveBeenCalledWith(entry.id);
    expect(control(renderer, 'manual-order-details-loaded')).toBeTruthy();
    expect(JSON.stringify(renderer.toJSON())).toContain('Nevsky 25');
    expect(JSON.stringify(renderer.toJSON())).toContain('Call on arrival');
    expect(JSON.stringify(renderer.toJSON())).toContain('4000 RUB');
    const details = JSON.stringify(renderer.toJSON());
    expect(details).toContain(new Date(entry.startAt).toLocaleDateString());
    expect(details).toContain(new Date(entry.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    expect(details).toContain(new Date(entry.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  });

  it('validates required fields and local date/time before creating', async () => {
    const dependencies = setup();
    const { renderer } = await renderForm(dependencies);
    expect(renderer.root.findAllByProps({ testID: 'manual-order-currency-input' })).toHaveLength(0);
    await press(renderer, 'manual-order-save-button');
    expect(control(renderer, 'manual-order-form-error').props.children).toContain('customer, service, and address');
    expect(dependencies.createScheduledManualOrder.execute).not.toHaveBeenCalled();

    await enter(renderer, 'manual-order-customer-input', 'Ivan');
    await enter(renderer, 'manual-order-service-input', 'Cleaning');
    await enter(renderer, 'manual-order-address-input', 'Nevsky 25');
    await enter(renderer, 'manual-order-date-input', '2030-04-03');
    await enter(renderer, 'manual-order-start-input', '12:00');
    await enter(renderer, 'manual-order-end-input', '11:00');
    await press(renderer, 'manual-order-save-button');
    expect(control(renderer, 'manual-order-form-error').props.children).toBe('Start time must be before end time.');
    expect(dependencies.createScheduledManualOrder.execute).not.toHaveBeenCalled();
  });

  it('creates the complete order with local schedule converted to UTC', async () => {
    const dependencies = setup();
    const { renderer, onSaved } = await renderForm(dependencies);
    await enter(renderer, 'manual-order-customer-input', ' Ivan ');
    await enter(renderer, 'manual-order-service-input', ' Apartment cleaning ');
    await enter(renderer, 'manual-order-address-input', ' Nevsky 25 ');
    await enter(renderer, 'manual-order-phone-input', '+7 900 000 00 00');
    await enter(renderer, 'manual-order-price-input', '4000');
    await enter(renderer, 'manual-order-date-input', '2030-04-03');
    await enter(renderer, 'manual-order-start-input', '10:00');
    await enter(renderer, 'manual-order-end-input', '12:00');
    await enter(renderer, 'manual-order-notes-input', ' Call on arrival ');
    await press(renderer, 'manual-order-save-button');

    expect(dependencies.createScheduledManualOrder.execute).toHaveBeenCalledWith({
      customerName: 'Ivan',
      serviceDescription: 'Apartment cleaning',
      serviceAddress: 'Nevsky 25',
      customerPhone: '+7 900 000 00 00',
      quotedPrice: { amountMinor: 400000, currencyCode: 'RUB' },
      notes: 'Call on arrival',
      startAt: new Date(2030, 3, 3, 10, 0).toISOString(),
      endAt: new Date(2030, 3, 3, 12, 0).toISOString(),
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('blocks duplicate submits while the create request is pending', async () => {
    const dependencies = setup();
    let finishSave: () => void = () => undefined;
    dependencies.createScheduledManualOrder.execute.mockReturnValueOnce(new Promise(resolve => {
      finishSave = () => resolve(order);
    }));
    const { renderer } = await renderForm(dependencies);
    await enter(renderer, 'manual-order-customer-input', 'Ivan');
    await enter(renderer, 'manual-order-service-input', 'Cleaning');
    await enter(renderer, 'manual-order-address-input', 'Nevsky 25');
    await enter(renderer, 'manual-order-date-input', '2030-04-03');
    await enter(renderer, 'manual-order-start-input', '10:00');
    await enter(renderer, 'manual-order-end-input', '12:00');

    await ReactTestRenderer.act(async () => {
      control(renderer, 'manual-order-save-button').props.onPress();
      await Promise.resolve();
    });
    await ReactTestRenderer.act(async () => {
      control(renderer, 'manual-order-save-button').props.onPress();
      await Promise.resolve();
    });
    expect(dependencies.createScheduledManualOrder.execute).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => {
      finishSave();
      await Promise.resolve();
    });
  });

  it('renders a safe error when order creation fails', async () => {
    const dependencies = setup();
    dependencies.createScheduledManualOrder.execute.mockRejectedValueOnce({ code: 'NetworkError' });
    const { renderer } = await renderForm(dependencies);
    await enter(renderer, 'manual-order-customer-input', 'Ivan');
    await enter(renderer, 'manual-order-service-input', 'Cleaning');
    await enter(renderer, 'manual-order-address-input', 'Nevsky 25');
    await enter(renderer, 'manual-order-date-input', '2030-04-03');
    await enter(renderer, 'manual-order-start-input', '10:00');
    await enter(renderer, 'manual-order-end-input', '12:00');
    await press(renderer, 'manual-order-save-button');
    expect(control(renderer, 'manual-order-form-error').props.children)
      .toBe('Couldn’t save the order. Please try again.');
    expect(JSON.stringify(renderer.toJSON())).not.toContain('NetworkError');
  });

  it('warns the user to inspect Calendar when compensation failed', async () => {
    const dependencies = setup();
    dependencies.createScheduledManualOrder.execute.mockRejectedValueOnce({
      code: 'ScheduledOrderCompensationFailed',
    });
    const { renderer } = await renderForm(dependencies);
    await enter(renderer, 'manual-order-customer-input', 'Ivan');
    await enter(renderer, 'manual-order-service-input', 'Cleaning');
    await enter(renderer, 'manual-order-address-input', 'Nevsky 25');
    await enter(renderer, 'manual-order-date-input', '2030-04-03');
    await enter(renderer, 'manual-order-start-input', '10:00');
    await enter(renderer, 'manual-order-end-input', '12:00');
    await press(renderer, 'manual-order-save-button');
    expect(control(renderer, 'manual-order-form-error').props.children)
      .toBe('Couldn’t finish saving the order. Check Calendar before retrying.');
  });
});
