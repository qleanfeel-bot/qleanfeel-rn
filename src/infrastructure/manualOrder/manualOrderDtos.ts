import type {
  CreateManualOrderInput,
  ManualOrder,
} from '../../domain/manualOrder/entities/ManualOrder';

export type ManualOrderDto = ManualOrder;

export interface ManualOrdersResponseDto {
  readonly orders: ManualOrderDto[];
}

export interface ManualOrderResponseDto {
  readonly order: ManualOrderDto;
}

export type ManualOrderCreateRequestDto = CreateManualOrderInput;
