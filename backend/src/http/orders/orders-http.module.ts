import { Module } from '@nestjs/common';
import { IdentityModule } from '../../infrastructure/identity/identity.module.js';
import { OrdersModule } from '../../infrastructure/orders/orders.module.js';
import { QleanfeelAccessGuard } from '../auth/qleanfeel-access.guard.js';
import { OrdersController } from './orders.controller.js';

@Module({
  imports: [IdentityModule, OrdersModule],
  controllers: [OrdersController],
  providers: [QleanfeelAccessGuard],
})
export class OrdersHttpModule {}
