import { Module, type Provider } from '@nestjs/common';
import {
  Clock,
  IdentifierGenerator,
} from '../../application/identity/ports/credential-services.js';
import { UnitOfWork } from '../../application/ports/unit-of-work.js';
import { CancelCleaning } from '../../application/cleanings/cancel-cleaning.js';
import { GetMyCleaning } from '../../application/cleanings/get-my-cleaning.js';
import { GetMyCleaningLifecycle } from '../../application/cleanings/get-my-cleaning-lifecycle.js';
import { CleaningReadPolicy } from '../../application/cleanings/cleaning-read-policy.js';
import { CleaningReadRepository } from '../../application/cleanings/ports/cleaning-read-repository.js';
import { CompleteCleaning } from '../../application/cleanings/complete-cleaning.js';
import { CleaningLifecyclePolicy } from '../../application/cleanings/cleaning-lifecycle-policy.js';
import { CleaningLifecycleRepository } from '../../application/cleanings/ports/cleaning-lifecycle-repository.js';
import { MarkCleaningNotPerformed } from '../../application/cleanings/mark-cleaning-not-performed.js';
import { PartiallyCompleteCleaning } from '../../application/cleanings/partially-complete-cleaning.js';
import { StartCleaning } from '../../application/cleanings/start-cleaning.js';
import { DatabaseModule } from '../persistence/database.module.js';
import { PostgresCleaningLifecycleRepository } from '../persistence/postgres-cleaning-lifecycle-repository.js';
import { PostgresCleaningReadRepository } from '../persistence/postgres-cleaning-read-repository.js';
import { SystemClock } from '../identity/system-clock.js';
import { UuidV7Generator } from '../identity/uuid-v7-generator.js';
import { IdentityModule } from '../identity/identity.module.js';

const commandDependencies = [
  UnitOfWork,
  CleaningLifecycleRepository,
  CleaningLifecyclePolicy,
  IdentifierGenerator,
  Clock,
];

const startProvider: Provider = {
  provide: StartCleaning,
  inject: commandDependencies,
  useFactory: (...dependencies: ConstructorParameters<typeof StartCleaning>) =>
    new StartCleaning(...dependencies),
};
const completeProvider: Provider = {
  provide: CompleteCleaning,
  inject: commandDependencies,
  useFactory: (
    ...dependencies: ConstructorParameters<typeof CompleteCleaning>
  ) => new CompleteCleaning(...dependencies),
};
const partiallyCompleteProvider: Provider = {
  provide: PartiallyCompleteCleaning,
  inject: commandDependencies,
  useFactory: (
    ...dependencies: ConstructorParameters<typeof PartiallyCompleteCleaning>
  ) => new PartiallyCompleteCleaning(...dependencies),
};
const cancelProvider: Provider = {
  provide: CancelCleaning,
  inject: commandDependencies,
  useFactory: (...dependencies: ConstructorParameters<typeof CancelCleaning>) =>
    new CancelCleaning(...dependencies),
};
const notPerformedProvider: Provider = {
  provide: MarkCleaningNotPerformed,
  inject: commandDependencies,
  useFactory: (
    ...dependencies: ConstructorParameters<typeof MarkCleaningNotPerformed>
  ) => new MarkCleaningNotPerformed(...dependencies),
};

const getMyCleaningProvider: Provider = {
  provide: GetMyCleaning,
  inject: [CleaningReadRepository, CleaningReadPolicy],
  useFactory: (
    repository: CleaningReadRepository,
    policy: CleaningReadPolicy,
  ) => new GetMyCleaning(repository, policy),
};

const getMyCleaningLifecycleProvider: Provider = {
  provide: GetMyCleaningLifecycle,
  inject: [CleaningReadRepository, CleaningReadPolicy],
  useFactory: (
    repository: CleaningReadRepository,
    policy: CleaningReadPolicy,
  ) => new GetMyCleaningLifecycle(repository, policy),
};

@Module({
  imports: [DatabaseModule, IdentityModule],
  providers: [
    PostgresCleaningLifecycleRepository,
    PostgresCleaningReadRepository,
    {
      provide: CleaningReadRepository,
      useExisting: PostgresCleaningReadRepository,
    },
    {
      provide: CleaningLifecycleRepository,
      useExisting: PostgresCleaningLifecycleRepository,
    },
    CleaningLifecyclePolicy,
    { provide: IdentifierGenerator, useClass: UuidV7Generator },
    { provide: Clock, useClass: SystemClock },
    startProvider,
    completeProvider,
    partiallyCompleteProvider,
    cancelProvider,
    notPerformedProvider,
    CleaningReadPolicy,
    getMyCleaningProvider,
    getMyCleaningLifecycleProvider,
  ],
  exports: [
    StartCleaning,
    CompleteCleaning,
    PartiallyCompleteCleaning,
    CancelCleaning,
    MarkCleaningNotPerformed,
    GetMyCleaning,
    GetMyCleaningLifecycle,
  ],
})
export class CleaningLifecycleModule {}
