import { HttpError } from '../../http/HttpError';
import { HttpTransport, type HttpFetch, type HttpResponse } from '../../http/HttpTransport';
import { ManualOrderApi } from '../ManualOrderApi';

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

function setup(status = 200, body: unknown = { orders: [orderDto] }) {
  const response: HttpResponse = { status, json: jest.fn().mockResolvedValue(body) };
  const fetchImplementation = jest.fn().mockResolvedValue(response) as jest.MockedFunction<HttpFetch>;
  const api = new ManualOrderApi(new HttpTransport({
    baseUrl: 'https://api.example',
    accessTokenProvider: { getAccessToken: jest.fn().mockResolvedValue('access-token') },
    fetchImplementation,
  }));
  return { api, fetchImplementation, response };
}

describe('ManualOrderApi', () => {
  it('gets the collection through an authenticated GET', async () => {
    const { api, fetchImplementation } = setup();

    await expect(api.getOrders()).resolves.toEqual({ orders: [orderDto] });
    expect(fetchImplementation).toHaveBeenCalledWith('https://api.example/v1/me/manual-orders', {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer access-token' },
    });
  });

  it('posts only the supplied create input through an authenticated POST', async () => {
    const { api, fetchImplementation } = setup(201, { order: orderDto });
    const body = {
      customerName: 'Ivan',
      serviceDescription: 'Cleaning',
      serviceAddress: 'Nevsky 25',
      calendarEntryId: 'entry-1',
    };

    await expect(api.createOrder(body)).resolves.toEqual({ order: orderDto });
    expect(fetchImplementation).toHaveBeenCalledWith('https://api.example/v1/me/manual-orders', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  });

  it('gets an encoded order id through an authenticated GET', async () => {
    const { api, fetchImplementation } = setup(200, { order: orderDto });

    await expect(api.getOrder('order/1')).resolves.toEqual({ order: orderDto });
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.example/v1/me/manual-orders/order%2F1',
      { method: 'GET', headers: { Accept: 'application/json', Authorization: 'Bearer access-token' } },
    );
  });

  it('maps HTTP failures to safe transport errors without parsing bodies', async () => {
    const { api, response } = setup(500, { error: { message: 'private detail' } });
    await expect(api.getOrders()).rejects.toEqual(new HttpError('ServerError'));
    expect(response.json).not.toHaveBeenCalled();
  });
});
