import { Module } from '@nestjs/common';
import { IdentityModule } from '../../infrastructure/identity/identity.module.js';
import { AuthController } from './auth.controller.js';
import { MeController } from './me.controller.js';
import { QleanfeelAccessGuard } from './qleanfeel-access.guard.js';
import { OrdersHttpModule } from '../orders/orders-http.module.js';

@Module({
  imports: [IdentityModule, OrdersHttpModule],
  controllers: [AuthController, MeController],
  providers: [QleanfeelAccessGuard],
})
export class IdentityHttpModule {}
