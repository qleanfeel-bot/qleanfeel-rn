import { Module, type Provider } from '@nestjs/common';
import { UnitOfWork } from '../../application/ports/unit-of-work.js';
import {
  AuthIdentityRepository,
  AuthSessionRepository,
  SessionRefreshTokenRepository,
  UserRepository,
} from '../../application/identity/ports/authentication-repositories.js';
import {
  AccessCredentialService,
  Clock,
  IdentifierGenerator,
  RefreshCredentialService,
} from '../../application/identity/ports/credential-services.js';
import { IdentityProofVerifier } from '../../application/identity/ports/identity-proof-verifier.js';
import { AuthenticateAccessCredential } from '../../application/identity/use-cases/authenticate-access-credential.js';
import { BootstrapAuthSession } from '../../application/identity/use-cases/bootstrap-auth-session.js';
import { GetCurrentUser } from '../../application/identity/use-cases/get-current-user.js';
import { LogoutAuthSession } from '../../application/identity/use-cases/logout-auth-session.js';
import { RefreshAuthSession } from '../../application/identity/use-cases/refresh-auth-session.js';
import { BackendConfigModule } from '../../shared/config/backend-config.module.js';
import {
  BACKEND_CONFIG,
  type BackendConfig,
} from '../../shared/config/backend-config.js';
import { DatabaseModule } from '../persistence/database.module.js';
import { PostgresAuthenticationRepositories } from '../persistence/postgres-authentication-repositories.js';
import { FirebaseIdentityProofVerifier } from './firebase-identity-proof-verifier.js';
import { JwtAccessCredentialService } from './jwt-access-credential-service.js';
import { SecureRefreshCredentialService } from './secure-refresh-credential-service.js';
import { SystemClock } from './system-clock.js';
import { UuidV7Generator } from './uuid-v7-generator.js';

const bootstrapProvider: Provider = {
  provide: BootstrapAuthSession,
  inject: [
    UnitOfWork,
    IdentityProofVerifier,
    UserRepository,
    AuthIdentityRepository,
    AuthSessionRepository,
    SessionRefreshTokenRepository,
    RefreshCredentialService,
    AccessCredentialService,
    IdentifierGenerator,
    Clock,
    BACKEND_CONFIG,
  ],
  useFactory: (
    unitOfWork: UnitOfWork,
    proofVerifier: IdentityProofVerifier,
    users: UserRepository,
    identities: AuthIdentityRepository,
    sessions: AuthSessionRepository,
    refreshTokens: SessionRefreshTokenRepository,
    refreshCredentialService: RefreshCredentialService,
    accessCredentialService: AccessCredentialService,
    identifiers: IdentifierGenerator,
    clock: Clock,
    config: BackendConfig,
  ) =>
    new BootstrapAuthSession(
      unitOfWork,
      proofVerifier,
      users,
      identities,
      sessions,
      refreshTokens,
      refreshCredentialService,
      accessCredentialService,
      identifiers,
      clock,
      config,
    ),
};

const refreshProvider: Provider = {
  provide: RefreshAuthSession,
  inject: [
    UnitOfWork,
    UserRepository,
    AuthSessionRepository,
    SessionRefreshTokenRepository,
    RefreshCredentialService,
    AccessCredentialService,
    IdentifierGenerator,
    Clock,
  ],
  useFactory: (
    unitOfWork: UnitOfWork,
    users: UserRepository,
    sessions: AuthSessionRepository,
    refreshTokens: SessionRefreshTokenRepository,
    refreshCredentialService: RefreshCredentialService,
    accessCredentialService: AccessCredentialService,
    identifiers: IdentifierGenerator,
    clock: Clock,
  ) =>
    new RefreshAuthSession(
      unitOfWork,
      users,
      sessions,
      refreshTokens,
      refreshCredentialService,
      accessCredentialService,
      identifiers,
      clock,
    ),
};

const authenticateProvider: Provider = {
  provide: AuthenticateAccessCredential,
  inject: [
    UnitOfWork,
    AccessCredentialService,
    AuthSessionRepository,
    UserRepository,
    Clock,
  ],
  useFactory: (
    unitOfWork: UnitOfWork,
    credentials: AccessCredentialService,
    sessions: AuthSessionRepository,
    users: UserRepository,
    clock: Clock,
  ) =>
    new AuthenticateAccessCredential(
      unitOfWork,
      credentials,
      sessions,
      users,
      clock,
    ),
};

const logoutProvider: Provider = {
  provide: LogoutAuthSession,
  inject: [
    UnitOfWork,
    AuthSessionRepository,
    SessionRefreshTokenRepository,
    Clock,
  ],
  useFactory: (
    unitOfWork: UnitOfWork,
    sessions: AuthSessionRepository,
    refreshTokens: SessionRefreshTokenRepository,
    clock: Clock,
  ) => new LogoutAuthSession(unitOfWork, sessions, refreshTokens, clock),
};

const getCurrentUserProvider: Provider = {
  provide: GetCurrentUser,
  inject: [UnitOfWork, UserRepository],
  useFactory: (unitOfWork: UnitOfWork, users: UserRepository) =>
    new GetCurrentUser(unitOfWork, users),
};

@Module({
  imports: [BackendConfigModule, DatabaseModule],
  providers: [
    PostgresAuthenticationRepositories,
    {
      provide: UserRepository,
      useExisting: PostgresAuthenticationRepositories,
    },
    {
      provide: AuthIdentityRepository,
      useExisting: PostgresAuthenticationRepositories,
    },
    {
      provide: AuthSessionRepository,
      useExisting: PostgresAuthenticationRepositories,
    },
    {
      provide: SessionRefreshTokenRepository,
      useExisting: PostgresAuthenticationRepositories,
    },
    { provide: IdentityProofVerifier, useClass: FirebaseIdentityProofVerifier },
    { provide: AccessCredentialService, useClass: JwtAccessCredentialService },
    {
      provide: RefreshCredentialService,
      useClass: SecureRefreshCredentialService,
    },
    { provide: IdentifierGenerator, useClass: UuidV7Generator },
    { provide: Clock, useClass: SystemClock },
    bootstrapProvider,
    refreshProvider,
    authenticateProvider,
    logoutProvider,
    getCurrentUserProvider,
  ],
  exports: [
    AuthenticateAccessCredential,
    BootstrapAuthSession,
    GetCurrentUser,
    LogoutAuthSession,
    RefreshAuthSession,
  ],
})
export class IdentityModule {}
