import assert from 'node:assert/strict';
import test from 'node:test';
import { jwtVerify } from 'jose';
import { AuthSession } from '../src/domain/identity/auth-session.js';
import { User } from '../src/domain/identity/user.js';
import { InvalidAccessCredentialError } from '../src/application/identity/identity-errors.js';
import { JwtAccessCredentialService } from '../src/infrastructure/identity/jwt-access-credential-service.js';
import { SecureRefreshCredentialService } from '../src/infrastructure/identity/secure-refresh-credential-service.js';
import { UuidV7Generator } from '../src/infrastructure/identity/uuid-v7-generator.js';

const signingSecret = 'unit-test-only-signing-secret-with-more-than-32-bytes';

test('User and AuthSession are provider-independent identity concepts', () => {
  const now = new Date('2026-10-04T00:00:00.000Z');
  const user = User.create('0199d4f0-7d00-7000-8000-000000000001', now);
  const session = AuthSession.create(
    '0199d4f0-7d00-7000-8000-000000000002',
    user.id,
    now,
    new Date(now.getTime() + 60_000),
  );

  assert.equal(user.status, 'active');
  assert.equal(user.isActive, true);
  assert.equal(session.userId, user.id);
  assert.equal(session.isActive, true);
  assert.equal('firebaseUid' in user, false);
});

test('UUID generator emits UUIDv7 identifiers', () => {
  const value = new UuidV7Generator().next();
  assert.match(
    value,
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test('refresh credentials have high entropy and persistence uses a one-way hash', () => {
  const service = new SecureRefreshCredentialService();
  const sessionId = '0199d4f0-7d00-7000-8000-000000000002';
  const first = service.create(sessionId);
  const second = service.create(sessionId);

  assert.notEqual(first.value, second.value);
  assert.notEqual(first.value, first.hash);
  assert.equal(first.hash, service.hash(first.value));
  assert.equal(service.hasSessionId(first.value, sessionId), true);
  assert.equal(service.hasSessionId(first.value, 'different-session'), false);
});

test('Qleanfeel access credentials contain only verified principal claims and reject tampering', async () => {
  const service = new JwtAccessCredentialService({
    environment: 'test',
    port: 3000,
    databaseUrl: 'postgresql://test:test@localhost/qleanfeel_test',
    databasePoolMax: 2,
    firebaseProjectId: undefined,
    accessTokenSigningSecret: signingSecret,
    authAccessTokenTtlSeconds: 300,
    authRefreshTokenTtlSeconds: 2_592_000,
  });
  const principal = {
    userId: '0199d4f0-7d00-7000-8000-000000000001',
    sessionId: '0199d4f0-7d00-7000-8000-000000000002',
  };
  const expiresAt = new Date(Date.now() + 60_000);
  const token = await service.issue(principal, expiresAt);
  const verified = await service.verify(token);
  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(signingSecret),
    { issuer: 'qleanfeel-api', audience: 'qleanfeel-api' },
  );

  assert.deepEqual(verified.principal, principal);
  assert.equal(payload.sub, principal.userId);
  assert.equal(payload.sid, principal.sessionId);
  assert.equal('firebaseUid' in payload, false);
  await assert.rejects(
    service.verify(`${token.slice(0, -1)}x`),
    InvalidAccessCredentialError,
  );
});
