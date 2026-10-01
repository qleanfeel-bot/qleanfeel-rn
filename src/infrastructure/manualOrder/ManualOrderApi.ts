import { HttpTransport } from '../http/HttpTransport';
import type {
  ManualOrderCreateRequestDto,
  ManualOrderResponseDto,
  ManualOrdersResponseDto,
} from './manualOrderDtos';

/** HTTP contract for the authenticated current user's manual orders. */
export class ManualOrderApi {
  public constructor(private readonly transport: HttpTransport) {}

  public getOrders(): Promise<ManualOrdersResponseDto> {
    return this.transport.request<ManualOrdersResponseDto>({
      method: 'GET',
      path: '/v1/me/manual-orders',
      authenticated: true,
    });
  }

  public createOrder(body: ManualOrderCreateRequestDto): Promise<ManualOrderResponseDto> {
    return this.transport.request<ManualOrderResponseDto>({
      method: 'POST',
      path: '/v1/me/manual-orders',
      body,
      authenticated: true,
    });
  }

  public getOrder(orderId: string): Promise<ManualOrderResponseDto> {
    return this.transport.request<ManualOrderResponseDto>({
      method: 'GET',
      path: `/v1/me/manual-orders/${encodeURIComponent(orderId)}`,
      authenticated: true,
    });
  }
}
