import type { ManualOrder } from '../../../domain/manualOrder/entities/ManualOrder';
import type { ManualOrderRepository } from '../../../domain/manualOrder/repositories/ManualOrderRepository';
import { HttpError } from '../../http/HttpError';
import { ManualOrderApi } from '../ManualOrderApi';
import { ManualOrderApiRepository } from '../ManualOrderApiRepository';

const orderDto = {
  id: 'order-1',
  customerName: 'Ivan',
  serviceDescription: 'Cleaning',
  serviceAddress: 'Nevsky 25',
  calendarEntryId: 'entry-1',
  createdAt: '2026-10-01T10:00:00.000Z',
  customerPhone: null,
  quotedPrice: null,
  notes: null,
};
const order: ManualOrder = { ...orderDto };

function createApi() {
  return {
    getOrders: jest.fn().mockResolvedValue({ orders: [orderDto] }),
    createOrder: jest.fn().mockResolvedValue({ order: orderDto }),
    getOrder: jest.fn().mockResolvedValue({ order: orderDto }),
  } as unknown as jest.Mocked<ManualOrderApi>;
}

describe('ManualOrderApiRepository', () => {
  it('implements ManualOrderRepository and maps collection DTOs', async () => {
    const api = createApi();
    const repository: ManualOrderRepository = new ManualOrderApiRepository(api);
    await expect(repository.getOrders()).resolves.toEqual([order]);
  });

  it('maps create input into a whitelisted request and maps the response', async () => {
    const api = createApi();
    const repository = new ManualOrderApiRepository(api);
    await expect(repository.createOrder({
      customerName: ' Ivan ',
      serviceDescription: 'Cleaning',
      serviceAddress: 'Nevsky 25',
      calendarEntryId: 'entry-1',
    })).resolves.toEqual(order);
    expect(api.createOrder).toHaveBeenCalledWith({
      customerName: 'Ivan',
      serviceDescription: 'Cleaning',
      serviceAddress: 'Nevsky 25',
      calendarEntryId: 'entry-1',
      customerPhone: null,
      quotedPrice: null,
      notes: null,
    });
  });

  it('gets an order by id and maps the DTO', async () => {
    const api = createApi();
    await expect(new ManualOrderApiRepository(api).getOrder('order-1')).resolves.toEqual(order);
    expect(api.getOrder).toHaveBeenCalledWith('order-1');
  });

  it.each([
    ['getOrders', 'BadRequest', 'ValidationError'],
    ['createOrder', 'Unauthorized', 'Unauthorized'],
    ['createOrder', 'Forbidden', 'Forbidden'],
    ['createOrder', 'NotFound', 'CalendarEntryNotFound'],
    ['getOrder', 'NotFound', 'OrderNotFound'],
    ['createOrder', 'ServerError', 'ServerError'],
    ['getOrders', 'NetworkError', 'NetworkError'],
  ] as const)('maps %s error %s to %s', async (operation, httpCode, expectedCode) => {
    const api = createApi();
    const error = new HttpError(httpCode);
    if (operation === 'getOrders') {
      api.getOrders.mockRejectedValueOnce(error);
      await expect(new ManualOrderApiRepository(api).getOrders()).rejects.toEqual({ code: expectedCode });
    } else if (operation === 'getOrder') {
      api.getOrder.mockRejectedValueOnce(error);
      await expect(new ManualOrderApiRepository(api).getOrder('order-1')).rejects.toEqual({ code: expectedCode });
    } else {
      api.createOrder.mockRejectedValueOnce(error);
      await expect(new ManualOrderApiRepository(api).createOrder({
        customerName: 'Ivan', serviceDescription: 'Cleaning', serviceAddress: 'Nevsky 25', calendarEntryId: 'entry-1',
      })).rejects.toEqual({ code: expectedCode });
    }
  });

  it('maps a malformed response into a safe unexpected response error', async () => {
    const api = createApi();
    api.getOrder.mockResolvedValueOnce({ order: { ...orderDto, status: 'open' } as never });
    await expect(new ManualOrderApiRepository(api).getOrder('order-1'))
      .rejects.toEqual({ code: 'UnexpectedResponse' });
  });

  it('rejects invalid local input before issuing an API request', async () => {
    const api = createApi();
    await expect(new ManualOrderApiRepository(api).createOrder({
      customerName: ' ',
      serviceDescription: 'Cleaning',
      serviceAddress: 'Nevsky 25',
      calendarEntryId: 'entry-1',
    })).rejects.toThrow(TypeError);
    expect(api.createOrder).not.toHaveBeenCalled();
  });
});
