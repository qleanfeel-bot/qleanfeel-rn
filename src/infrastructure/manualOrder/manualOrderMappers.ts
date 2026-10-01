import {
  createManualOrder,
  validateCreateManualOrderInput,
  type ManualOrder,
} from '../../domain/manualOrder/entities/ManualOrder';
import type { CreateManualOrderInput } from '../../domain/manualOrder/entities/ManualOrder';
import type {
  ManualOrderCreateRequestDto,
  ManualOrderDto,
} from './manualOrderDtos';

export function manualOrderFromDto(dto: unknown): ManualOrder {
  try {
    return createManualOrder(dto);
  } catch {
    throw { code: 'UnexpectedResponse' };
  }
}

export function manualOrdersFromDto(response: unknown): ManualOrder[] {
  if (
    typeof response !== 'object' ||
    response === null ||
    !('orders' in response) ||
    !Array.isArray(response.orders)
  ) {
    throw { code: 'UnexpectedResponse' };
  }
  return response.orders.map((dto: ManualOrderDto) => manualOrderFromDto(dto));
}

export function manualOrderCreateRequestFromInput(
  input: CreateManualOrderInput,
): ManualOrderCreateRequestDto {
  const normalized = validateCreateManualOrderInput(input);
  return {
    ...normalized,
    ...(normalized.customerPhone === null ? {} : { customerPhone: normalized.customerPhone }),
    ...(normalized.quotedPrice === null ? {} : { quotedPrice: normalized.quotedPrice }),
    ...(normalized.notes === null ? {} : { notes: normalized.notes }),
  };
}
