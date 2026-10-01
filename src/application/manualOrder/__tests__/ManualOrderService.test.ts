import type { ManualOrder } from '../../../domain/manualOrder/entities/ManualOrder';
import type { ManualOrderRepository } from '../../../domain/manualOrder/repositories/ManualOrderRepository';
import { ManualOrderService } from '../ManualOrderService';

const order: ManualOrder = {
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

function createRepository(): jest.Mocked<ManualOrderRepository> {
  return {
    getOrders: jest.fn().mockResolvedValue([order]),
    createOrder: jest.fn().mockResolvedValue(order),
    getOrder: jest.fn().mockResolvedValue(order),
  };
}

describe('ManualOrderService', () => {
  it('delegates list, create, and get to its repository', async () => {
    const repository = createRepository();
    const service = new ManualOrderService(repository);
    const input = {
      customerName: 'Ivan',
      serviceDescription: 'Cleaning',
      serviceAddress: 'Nevsky 25',
      calendarEntryId: 'entry-1',
    };

    await expect(service.getOrders()).resolves.toEqual([order]);
    await expect(service.create(input)).resolves.toBe(order);
    await expect(service.get(order.id)).resolves.toBe(order);
    expect(repository.getOrders).toHaveBeenCalledTimes(1);
    expect(repository.createOrder).toHaveBeenCalledWith(input);
    expect(repository.getOrder).toHaveBeenCalledWith(order.id);
  });

  it('propagates repository failures unchanged', async () => {
    const failure = { code: 'NetworkError' };
    const repository = createRepository();
    repository.getOrders.mockRejectedValueOnce(failure);

    await expect(new ManualOrderService(repository).getOrders()).rejects.toBe(failure);
  });
});
