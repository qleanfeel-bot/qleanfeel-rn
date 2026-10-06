import { Module, type Provider } from '@nestjs/common';
import { UnitOfWork } from '../../application/ports/unit-of-work.js';
import { CalendarEntryRepository } from '../../application/calendar/ports/calendar-entry-repository.js';
import { CreateOrderCalendarEntry } from '../../application/calendar/create-order-calendar-entry.js';
import { CalendarScheduleCreator } from '../../application/calendar/ports/calendar-schedule-creator.js';
import {
  Clock,
  IdentifierGenerator,
} from '../../application/identity/ports/credential-services.js';
import { CreateManualOrder } from '../../application/orders/create-manual-order.js';
import { CreateManualOrderPolicy } from '../../application/orders/create-manual-order-policy.js';
import {
  CleaningRepository,
  OrderRepository,
  OrderTermsRepository,
} from '../../application/orders/ports/order-repositories.js';
import { DatabaseModule } from '../persistence/database.module.js';
import { PostgresOrderRepositories } from '../persistence/postgres-order-repositories.js';
import { SystemClock } from '../identity/system-clock.js';
import { UuidV7Generator } from '../identity/uuid-v7-generator.js';
import { IdentityModule } from '../identity/identity.module.js';

const createManualOrderProvider: Provider = {
  provide: CreateManualOrder,
  inject: [
    UnitOfWork,
    OrderRepository,
    OrderTermsRepository,
    CleaningRepository,
    CalendarScheduleCreator,
    CreateManualOrderPolicy,
    IdentifierGenerator,
    Clock,
  ],
  useFactory: (
    unitOfWork: UnitOfWork,
    orders: OrderRepository,
    terms: OrderTermsRepository,
    cleanings: CleaningRepository,
    calendarScheduleCreator: CalendarScheduleCreator,
    policy: CreateManualOrderPolicy,
    identifiers: IdentifierGenerator,
    clock: Clock,
  ) =>
    new CreateManualOrder(
      unitOfWork,
      orders,
      terms,
      cleanings,
      calendarScheduleCreator,
      policy,
      identifiers,
      clock,
    ),
};

@Module({
  imports: [DatabaseModule, IdentityModule],
  providers: [
    PostgresOrderRepositories,
    {
      provide: CalendarEntryRepository,
      useExisting: PostgresOrderRepositories,
    },
    { provide: OrderRepository, useExisting: PostgresOrderRepositories },
    { provide: OrderTermsRepository, useExisting: PostgresOrderRepositories },
    { provide: CleaningRepository, useExisting: PostgresOrderRepositories },
    {
      provide: CreateOrderCalendarEntry,
      inject: [CalendarEntryRepository, IdentifierGenerator, Clock],
      useFactory: (
        entries: CalendarEntryRepository,
        identifiers: IdentifierGenerator,
        clock: Clock,
      ) => new CreateOrderCalendarEntry(entries, identifiers, clock),
    },
    {
      provide: CalendarScheduleCreator,
      useExisting: CreateOrderCalendarEntry,
    },
    CreateManualOrderPolicy,
    { provide: IdentifierGenerator, useClass: UuidV7Generator },
    { provide: Clock, useClass: SystemClock },
    createManualOrderProvider,
  ],
  exports: [CreateManualOrder],
})
export class OrdersModule {}
