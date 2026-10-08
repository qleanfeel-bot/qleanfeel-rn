import type { AuthenticatedPrincipal } from '../identity/authenticated-principal.js';
import type { IdentifierGenerator } from '../identity/ports/credential-services.js';
import type { UnitOfWorkContext } from '../ports/unit-of-work.js';
import { CleaningLifecycleEvent } from '../../domain/cleanings/cleaning-lifecycle-event.js';
import type { CleaningLifecycleEventType } from '../../domain/cleanings/cleaning-lifecycle-event.js';
import type { Cleaning } from '../../domain/cleanings/cleaning.js';
import {
  CleaningNotFoundError,
  CleaningVersionConflictError,
} from './cleaning-lifecycle-errors.js';
import type {
  CleaningLifecycleOperation,
  CleaningLifecyclePolicy,
} from './cleaning-lifecycle-policy.js';
import type {
  CleaningLifecycleRecord,
  CleaningLifecycleRepository,
} from './ports/cleaning-lifecycle-repository.js';

export async function loadOwnedCleaning(
  repository: CleaningLifecycleRepository,
  policy: CleaningLifecyclePolicy,
  principal: AuthenticatedPrincipal,
  cleaningId: string,
  operation: CleaningLifecycleOperation,
  context: UnitOfWorkContext,
): Promise<CleaningLifecycleRecord> {
  const record = await repository.findForLifecycle(cleaningId, context);
  if (!record) throw new CleaningNotFoundError();
  if (
    policy.evaluate(principal, operation, {
      orderOwnerUserId: record.orderOwnerUserId,
    }).outcome !== 'permit'
  ) {
    // Conceal the existence of Cleanings belonging to another account.
    throw new CleaningNotFoundError();
  }
  return record;
}

export async function persistCleaningTransition(
  repository: CleaningLifecycleRepository,
  identifiers: IdentifierGenerator,
  principal: AuthenticatedPrincipal,
  previous: Cleaning,
  updated: Cleaning,
  eventType: CleaningLifecycleEventType,
  occurredAt: Date,
  context: UnitOfWorkContext,
): Promise<Cleaning> {
  const updatedWithExpectedVersion = await repository.updateState(
    updated,
    previous.version,
    context,
  );
  if (!updatedWithExpectedVersion) {
    throw new CleaningVersionConflictError();
  }

  const event = CleaningLifecycleEvent.record(
    identifiers.next(),
    updated.id,
    eventType,
    principal.userId,
    occurredAt,
    occurredAt,
    updated.version,
  );
  await repository.appendLifecycleEvent(event, context);
  return updated;
}
