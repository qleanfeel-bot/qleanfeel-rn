import {
  manualOrderCreateRequestFromInput,
  manualOrderFromDto,
  manualOrdersFromDto,
} from '../manualOrderMappers';

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

describe('ManualOrder mappers', () => {
  it('maps valid order DTOs and collection envelopes into domain entities', () => {
    expect(manualOrderFromDto(orderDto)).toEqual(orderDto);
    expect(manualOrdersFromDto({ orders: [orderDto] })).toEqual([orderDto]);
    expect(manualOrdersFromDto({ orders: [] })).toEqual([]);
  });

  it('maps malformed DTOs and envelopes to a safe error', () => {
    expect(() => manualOrderFromDto({ ...orderDto, status: 'open' })).toThrow();
    expect(() => manualOrderFromDto({ ...orderDto, quotedPrice: { amountMinor: -1, currencyCode: 'RUB' } }))
      .toThrow();
    expect(() => manualOrdersFromDto({ orders: null })).toThrow();
  });

  it('creates a request containing only client-owned order fields', () => {
    const request = manualOrderCreateRequestFromInput({
      customerName: ' Ivan ',
      serviceDescription: ' Cleaning ',
      serviceAddress: ' Nevsky 25 ',
      calendarEntryId: 'entry-1',
      customerPhone: null,
      quotedPrice: { amountMinor: 400000, currencyCode: 'RUB' },
      notes: null,
    });

    expect(request).toEqual({
      customerName: 'Ivan',
      serviceDescription: 'Cleaning',
      serviceAddress: 'Nevsky 25',
      calendarEntryId: 'entry-1',
      customerPhone: null,
      quotedPrice: { amountMinor: 400000, currencyCode: 'RUB' },
      notes: null,
    });
    expect(Object.keys(request).sort()).toEqual([
      'calendarEntryId', 'customerName', 'customerPhone', 'notes', 'quotedPrice',
      'serviceAddress', 'serviceDescription',
    ]);
  });

  it('rejects protected fields rather than passing them to the API', () => {
    expect(() => manualOrderCreateRequestFromInput({
      customerName: 'Ivan',
      serviceDescription: 'Cleaning',
      serviceAddress: 'Nevsky 25',
      calendarEntryId: 'entry-1',
      id: 'client-id',
    } as never)).toThrow();
  });
});
