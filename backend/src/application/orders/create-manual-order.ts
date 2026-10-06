import { AuthorizationDeniedError } from '../authorization/authorization-errors.js';
import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';
import type {
  Clock,
  IdentifierGenerator,
} from '../identity/ports/credential-services.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import type { CalendarEntry } from '../../domain/calendar/calendar-entry.js';
import {
  assertValidSchedule,
  type CalendarSchedule,
} from '../../domain/calendar/calendar-entry.js';
import { Cleaning } from '../../domain/cleanings/cleaning.js';
import type { OrderTermsInput } from '../../domain/orders/order-terms.js';
import { OrderTerms } from '../../domain/orders/order-terms.js';
import { Order } from '../../domain/orders/order.js';
import { CalendarScheduleCreator } from '../calendar/ports/calendar-schedule-creator.js';
import { CreateManualOrderPolicy } from './create-manual-order-policy.js';
import {
  CleaningRepository,
  OrderRepository,
  OrderTermsRepository,
} from './ports/order-repositories.js';

export interface CreateManualOrderInput {
  readonly terms: OrderTermsInput;
  readonly schedule?: CalendarSchedule;
}

export interface CreateManualOrderResult {
  readonly order: Order;
  readonly terms: OrderTerms;
  readonly cleaning: Cleaning;
  readonly calendarEntry?: CalendarEntry;
}

export class CreateManualOrder {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly orders: OrderRepository,
    private readonly orderTerms: OrderTermsRepository,
    private readonly cleanings: CleaningRepository,
    private readonly calendarScheduleCreator: CalendarScheduleCreator,
    private readonly policy: CreateManualOrderPolicy,
    private readonly identifiers: IdentifierGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    principal: AuthenticatedPrincipal,
    input: CreateManualOrderInput,
  ): Promise<CreateManualOrderResult> {
    if (
      this.policy.evaluate(principal, 'create_manual_order').outcome !==
      'permit'
    ) {
      throw new AuthorizationDeniedError();
    }
    if (input.schedule) assertValidSchedule(input.schedule);

    return this.unitOfWork.execute(async context => {
      const now = this.clock.now();
      const order = Order.createManual(
        this.identifiers.next(),
        principal.userId,
        now,
      );
      const terms = OrderTerms.createInitial(
        this.identifiers.next(),
        order.id,
        input.terms,
        now,
      );
      const cleaning = Cleaning.createInitial(
        this.identifiers.next(),
        order.id,
        now,
      );

      await this.orders.create(order, context);
      await this.orderTerms.create(terms, context);
      await this.cleanings.create(cleaning, context);

      if (!input.schedule) {
        return { order, terms, cleaning };
      }

      const calendarEntry =
        await this.calendarScheduleCreator.createForManualOrder(
          principal.userId,
          input.schedule,
          context,
        );
      const scheduledCleaning = cleaning.withCalendarEntry(calendarEntry.id);
      await this.cleanings.associateCalendarEntry(scheduledCleaning, context);

      return {
        order,
        terms,
        cleaning: scheduledCleaning,
        calendarEntry,
      };
    });
  }
}
