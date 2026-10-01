import { createManualOrder, validateCreateManualOrderInput } from '../ManualOrder';

const validInput = {
  customerName: 'Ivan',
  serviceDescription: 'Apartment cleaning',
  serviceAddress: 'Nevsky 25',
  calendarEntryId: 'calendar-1',
  customerPhone: null,
  quotedPrice: null,
  notes: null,
};

describe('ManualOrder', () => {
  it('creates a valid entity and trims required fields', () => {
    expect(createManualOrder({
      ...validInput,
      customerName: ' Ivan ',
      serviceDescription: ' Apartment cleaning ',
      serviceAddress: ' Nevsky 25 ',
      id: 'order-1',
      createdAt: '2026-10-01T10:00:00.000Z',
    })).toEqual({
      ...validInput,
      customerName: 'Ivan',
      serviceDescription: 'Apartment cleaning',
      serviceAddress: 'Nevsky 25',
      id: 'order-1',
      createdAt: '2026-10-01T10:00:00.000Z',
    });
  });

  it.each(['customerName', 'serviceDescription', 'serviceAddress', 'calendarEntryId'] as const)(
    'rejects an empty required field: %s', field => {
      expect(() => validateCreateManualOrderInput({ ...validInput, [field]: '  ' })).toThrow(TypeError);
    },
  );

  it('accepts optional values and a non-negative integer price', () => {
    expect(validateCreateManualOrderInput({
      ...validInput,
      customerPhone: '+7 900 000 00 00',
      quotedPrice: { amountMinor: 400000, currencyCode: ' RUB ' },
      notes: 'Please call on arrival',
    })).toEqual({
      ...validInput,
      customerPhone: '+7 900 000 00 00',
      quotedPrice: { amountMinor: 400000, currencyCode: 'RUB' },
      notes: 'Please call on arrival',
    });
  });

  it('accepts a well-formed currency code without restricting the domain to RUB', () => {
    expect(validateCreateManualOrderInput({
      ...validInput,
      quotedPrice: { amountMinor: 1234, currencyCode: ' USD ' },
    }).quotedPrice).toEqual({ amountMinor: 1234, currencyCode: 'USD' });
  });

  it.each([
    { amountMinor: -1, currencyCode: 'RUB' },
    { amountMinor: 1.5, currencyCode: 'RUB' },
    { amountMinor: Number.NaN, currencyCode: 'RUB' },
    { amountMinor: Number.MAX_SAFE_INTEGER + 1, currencyCode: 'RUB' },
    { amountMinor: 0, currencyCode: '  ' },
    { amountMinor: 0, currencyCode: 'rub' },
    { amountMinor: 0, currencyCode: 'R U B' },
    { amountMinor: 0, currencyCode: 'RUB1' },
    { amountMinor: 0, currencyCode: 'RUB', userId: 'user-1' },
  ])('rejects an invalid quoted price %#', quotedPrice => {
    expect(() => validateCreateManualOrderInput({ ...validInput, quotedPrice })).toThrow(TypeError);
  });

  it('rejects optional values of the wrong type', () => {
    expect(() => validateCreateManualOrderInput({ ...validInput, customerPhone: 7 })).toThrow(TypeError);
    expect(() => validateCreateManualOrderInput({ ...validInput, notes: false })).toThrow(TypeError);
  });

  it.each(['id', 'createdAt', 'userId', 'status', 'startAt', 'endAt'])(
    'rejects server-owned or separately owned create field %s', field => {
      expect(() => validateCreateManualOrderInput({ ...validInput, [field]: 'not-client-owned' }))
        .toThrow(TypeError);
    },
  );

  it('rejects protected fields in a complete entity DTO', () => {
    expect(() => createManualOrder({
      ...validInput,
      id: 'order-1',
      createdAt: '2026-10-01T10:00:00.000Z',
      status: 'open',
    })).toThrow(TypeError);
  });
});
