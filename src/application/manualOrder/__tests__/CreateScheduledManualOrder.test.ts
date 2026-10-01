import type { CalendarEntry } from '../../../domain/calendar/entities/CalendarEntry';
import type { CalendarRepository } from '../../../domain/calendar/repositories/CalendarRepository';
import type { ManualOrder } from '../../../domain/manualOrder/entities/ManualOrder';
import type { ManualOrderRepository } from '../../../domain/manualOrder/repositories/ManualOrderRepository';
import { CalendarService } from '../../calendar/CalendarService';
import { ManualOrderService } from '../ManualOrderService';
import { CreateScheduledManualOrder } from '../CreateScheduledManualOrder';

const entry: CalendarEntry = {
  id: 'entry-1',
  startAt: '2026-10-05T07:00:00Z',
  endAt: '2026-10-05T09:00:00Z',
  type: 'external_order',
  status: 'scheduled',
  title: 'Apartment cleaning',
};
const order: ManualOrder = {
  id: 'order-1',
  customerName: 'Ivan',
  serviceDescription: 'Apartment cleaning',
  serviceAddress: 'Nevsky 25',
  calendarEntryId: entry.id,
  createdAt: '2026-10-01T10:00:00.000Z',
  customerPhone: null,
  quotedPrice: null,
  notes: null,
};

function setup() {
  const calendarRepository: jest.Mocked<CalendarRepository> = {
    getEntries: jest.fn().mockResolvedValue([]),
    getEntry: jest.fn().mockResolvedValue(entry),
    createEntry: jest.fn().mockResolvedValue(entry),
    updateEntry: jest.fn().mockResolvedValue(entry),
    deleteEntry: jest.fn().mockResolvedValue(undefined),
  };
  const orderRepository: jest.Mocked<ManualOrderRepository> = {
    getOrders: jest.fn().mockResolvedValue([]),
    createOrder: jest.fn().mockResolvedValue(order),
    getOrder: jest.fn().mockResolvedValue(order),
  };
  const calendar = new CalendarService(calendarRepository);
  const orders = new ManualOrderService(orderRepository);
  return {
    calendarRepository,
    orderRepository,
    useCase: new CreateScheduledManualOrder(calendar, orders),
  };
}

const input = {
  customerName: ' Ivan ',
  serviceDescription: ' Apartment cleaning ',
  serviceAddress: 'Nevsky 25',
  startAt: entry.startAt,
  endAt: entry.endAt,
};

describe('CreateScheduledManualOrder', () => {
  it('creates a CalendarEntry first and links the resulting id from ManualOrder', async () => {
    const { calendarRepository, orderRepository, useCase } = setup();

    await expect(useCase.execute(input)).resolves.toBe(order);
    expect(calendarRepository.createEntry).toHaveBeenCalledWith({
      startAt: entry.startAt,
      endAt: entry.endAt,
      type: 'external_order',
      title: 'Apartment cleaning',
    });
    expect(orderRepository.createOrder).toHaveBeenCalledWith({
      customerName: 'Ivan',
      serviceDescription: 'Apartment cleaning',
      serviceAddress: 'Nevsky 25',
      calendarEntryId: entry.id,
      customerPhone: null,
      quotedPrice: null,
      notes: null,
    });
    expect(calendarRepository.deleteEntry).not.toHaveBeenCalled();
  });

  it('returns a Calendar creation failure without attempting compensation', async () => {
    const { calendarRepository, orderRepository, useCase } = setup();
    const failure = { code: 'ValidationError' };
    calendarRepository.createEntry.mockRejectedValueOnce(failure);

    await expect(useCase.execute(input)).rejects.toBe(failure);
    expect(orderRepository.createOrder).not.toHaveBeenCalled();
    expect(calendarRepository.deleteEntry).not.toHaveBeenCalled();
  });

  it('validates ManualOrder details before creating a CalendarEntry', async () => {
    const { calendarRepository, useCase } = setup();

    await expect(useCase.execute({ ...input, customerName: ' ' })).rejects.toThrow(TypeError);
    expect(calendarRepository.createEntry).not.toHaveBeenCalled();
  });

  it('compensates Calendar creation when ManualOrder creation fails and propagates the error', async () => {
    const { calendarRepository, orderRepository, useCase } = setup();
    const failure = { code: 'NetworkError' };
    orderRepository.createOrder.mockRejectedValueOnce(failure);

    await expect(useCase.execute(input)).rejects.toBe(failure);
    expect(calendarRepository.deleteEntry).toHaveBeenCalledWith(entry.id);
  });

  it('reports a safe compensation failure code if Calendar cleanup also fails', async () => {
    const { calendarRepository, orderRepository, useCase } = setup();
    orderRepository.createOrder.mockRejectedValueOnce({ code: 'NetworkError' });
    calendarRepository.deleteEntry.mockRejectedValueOnce({ code: 'NetworkError' });

    await expect(useCase.execute(input)).rejects.toEqual({ code: 'ScheduledOrderCompensationFailed' });
  });
});
