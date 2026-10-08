import { Module } from '@nestjs/common';
import { IdentityModule } from '../../infrastructure/identity/identity.module.js';
import { CleaningLifecycleModule } from '../../infrastructure/cleanings/cleaning-lifecycle.module.js';
import { QleanfeelAccessGuard } from '../auth/qleanfeel-access.guard.js';
import { CleaningsController } from './cleanings.controller.js';

@Module({
  imports: [IdentityModule, CleaningLifecycleModule],
  controllers: [CleaningsController],
  providers: [QleanfeelAccessGuard],
})
export class CleaningsHttpModule {}
