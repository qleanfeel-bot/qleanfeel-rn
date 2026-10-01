import {
  CALENDAR_ENTRY_TYPES,
} from '../../domain/calendar/entities/CalendarEntry';
import type { CalendarService } from '../calendar/CalendarService';
import {
  validateManualOrderDetailsInput,
  type CreateManualOrderInput,
  type ManualOrder,
} from '../../domain/manualOrder/entities/ManualOrder';
import { ManualOrderService } from './ManualOrderService';

export interface CreateScheduledManualOrderInput extends Omit<CreateManualOrderInput, 'calendarEntryId'> {
  readonly startAt: string;
  readonly endAt: string;
}

/** Coordinates Calendar and ManualOrder creation with development-level compensation. */
export class CreateScheduledManualOrder {
  public constructor(
    private readonly calendar: CalendarService,
    private readonly orders: ManualOrderService,
  ) {}

  public async execute(input: CreateScheduledManualOrderInput): Promise<ManualOrder> {
    const orderInput = validateManualOrderDetailsInput({
      customerName: input.customerName,
      serviceDescription: input.serviceDescription,
      serviceAddress: input.serviceAddress,
      customerPhone: input.customerPhone,
      quotedPrice: input.quotedPrice,
      notes: input.notes,
    });
    const entry = await this.calendar.createEntry({
      startAt: input.startAt,
      endAt: input.endAt,
      type: CALENDAR_ENTRY_TYPES.EXTERNAL_ORDER,
      title: orderInput.serviceDescription,
    });

    try {
      return await this.orders.create({
        ...orderInput,
        calendarEntryId: entry.id,
      });
    } catch (creationError) {
      try {
        await this.calendar.deleteEntry(entry.id);
      } catch {
        throw { code: 'ScheduledOrderCompensationFailed' };
      }
      throw creationError;
    }
  }
}
