import type {
  CreateManualOrderInput,
  ManualOrder,
} from '../../domain/manualOrder/entities/ManualOrder';
import type { ManualOrderRepository } from '../../domain/manualOrder/repositories/ManualOrderRepository';
import { HttpError } from '../http/HttpError';
import { ManualOrderApi } from './ManualOrderApi';
import {
  manualOrderCreateRequestFromInput,
  manualOrderFromDto,
  manualOrdersFromDto,
} from './manualOrderMappers';

/** Adapts the ManualOrder repository contract to authenticated HTTP. */
export class ManualOrderApiRepository implements ManualOrderRepository {
  public constructor(private readonly api: ManualOrderApi) {}

  public async getOrders(): Promise<ManualOrder[]> {
    try {
      return manualOrdersFromDto(await this.api.getOrders());
    } catch (error) {
      throw toRepositoryError(error, 'list');
    }
  }

  public async createOrder(input: CreateManualOrderInput): Promise<ManualOrder> {
    const request = manualOrderCreateRequestFromInput(input);
    try {
      const response = await this.api.createOrder(request);
      if (!isRecord(response) || !('order' in response)) {
        throw { code: 'UnexpectedResponse' };
      }
      return manualOrderFromDto(response.order);
    } catch (error) {
      throw toRepositoryError(error, 'create');
    }
  }

  public async getOrder(orderId: string): Promise<ManualOrder> {
    try {
      const response = await this.api.getOrder(orderId);
      if (!isRecord(response) || !('order' in response)) {
        throw { code: 'UnexpectedResponse' };
      }
      return manualOrderFromDto(response.order);
    } catch (error) {
      throw toRepositoryError(error, 'get');
    }
  }
}

function toRepositoryError(
  error: unknown,
  operation: 'list' | 'create' | 'get',
): { readonly code: string } {
  if (error instanceof HttpError) {
    switch (error.code) {
      case 'BadRequest':
        return { code: 'ValidationError' };
      case 'Unauthorized':
        return { code: 'Unauthorized' };
      case 'Forbidden':
        return { code: 'Forbidden' };
      case 'NotFound':
        if (operation === 'get') {
          return { code: 'OrderNotFound' };
        }
        return { code: operation === 'create' ? 'CalendarEntryNotFound' : 'UnexpectedResponse' };
      case 'Conflict':
        return { code: 'UnexpectedResponse' };
      case 'ServerError':
        return { code: 'ServerError' };
      case 'NetworkError':
        return { code: 'NetworkError' };
      case 'UnexpectedResponse':
        return { code: 'UnexpectedResponse' };
    }
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { readonly code: unknown }).code;
    if (code === 'UnexpectedResponse') {
      return { code };
    }
  }
  return { code: 'UnexpectedResponse' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
