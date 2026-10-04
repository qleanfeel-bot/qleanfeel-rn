import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AuthorizationDeniedError } from '../src/application/authorization/authorization-errors.js';
import {
  DENY,
  PERMIT,
  type AuthorizationDecision,
} from '../src/application/authorization/authorization-decision.js';
import type { ResourceAuthorizationPolicy } from '../src/application/authorization/resource-authorization-policy.js';
import { InvalidAccessCredentialError } from '../src/application/identity/identity-errors.js';
import type { AuthenticatedPrincipal } from '../src/application/identity/authenticated-principal.js';

type Operation = 'read' | 'update';

interface ResourceFacts {
  readonly ownerUserId: string;
  readonly callerSuppliedUserId?: string;
  readonly callerSuppliedOwnerId?: string;
  readonly callerSuppliedRole?: string;
}

const selfOwnedResourcePolicy: ResourceAuthorizationPolicy<
  Operation,
  ResourceFacts
> = {
  evaluate(principal, _operation, facts) {
    return principal.userId === facts.ownerUserId ? PERMIT : DENY;
  },
};

const principal: AuthenticatedPrincipal = {
  userId: 'trusted-user',
  sessionId: 'trusted-session',
};

test('permits an operation when trusted principal owns the loaded resource', () => {
  const decision = selfOwnedResourcePolicy.evaluate(principal, 'read', {
    ownerUserId: 'trusted-user',
  });

  assert.deepEqual(decision, { outcome: 'permit' });
});

test('denies an operation when the trusted principal has no owning relationship', () => {
  const decision = selfOwnedResourcePolicy.evaluate(principal, 'update', {
    ownerUserId: 'another-user',
  });

  assert.deepEqual(decision, { outcome: 'deny' });
});

test('uses AuthenticatedPrincipal and ignores caller-supplied identity or role claims', () => {
  const facts: ResourceFacts = {
    ownerUserId: 'another-user',
    callerSuppliedUserId: principal.userId,
    callerSuppliedOwnerId: principal.userId,
    callerSuppliedRole: 'owner',
  };

  assert.deepEqual(
    selfOwnedResourcePolicy.evaluate(principal, 'update', facts),
    { outcome: 'deny' },
  );
  assert.deepEqual(
    selfOwnedResourcePolicy.evaluate(
      { userId: 'another-user', sessionId: principal.sessionId },
      'read',
      facts,
    ),
    { outcome: 'permit' },
  );
});

test('authorization denial is distinct from authentication failure', () => {
  const decision: AuthorizationDecision = DENY;
  assert.equal(decision.outcome, 'deny');

  const denial = new AuthorizationDeniedError();
  assert.equal(denial.name, 'AuthorizationDeniedError');
  assert.ok(denial instanceof Error);
  assert.ok(!(denial instanceof InvalidAccessCredentialError));
});

test('authorization application code has no HTTP, persistence, or provider imports', () => {
  const authorizationFiles = [
    '../src/application/authorization/authorization-decision.ts',
    '../src/application/authorization/resource-authorization-policy.ts',
    '../src/application/authorization/authorization-errors.ts',
  ];
  const forbiddenImport = /from\s+['"](?:@nestjs\/|drizzle-orm|pg|firebase-admin)/;

  for (const file of authorizationFiles) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, forbiddenImport, file);
  }
});
