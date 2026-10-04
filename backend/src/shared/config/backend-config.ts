export type RuntimeEnvironment = 'local' | 'test' | 'staging' | 'production';

export interface BackendConfig {
  readonly environment: RuntimeEnvironment;
  readonly port: number;
  readonly databaseUrl: string;
  readonly databasePoolMax: number;
  readonly firebaseProjectId: string | undefined;
  readonly accessTokenSigningSecret: string | undefined;
  readonly authAccessTokenTtlSeconds: number;
  readonly authRefreshTokenTtlSeconds: number;
}

export const BACKEND_CONFIG = Symbol('BACKEND_CONFIG');

const allowedEnvironments: readonly RuntimeEnvironment[] = [
  'local',
  'test',
  'staging',
  'production',
];

export function loadBackendConfig(
  environment: NodeJS.ProcessEnv = process.env,
): BackendConfig {
  const environmentName = environment.APP_ENV ?? 'local';

  if (!allowedEnvironments.includes(environmentName as RuntimeEnvironment)) {
    throw new Error('APP_ENV must be local, test, staging, or production.');
  }

  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  let parsedDatabaseUrl: URL;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol.');
  }

  const accessTokenSigningSecret =
    environment.ACCESS_TOKEN_SIGNING_SECRET || undefined;
  if (
    accessTokenSigningSecret !== undefined &&
    Buffer.byteLength(accessTokenSigningSecret, 'utf8') < 32
  ) {
    throw new Error('ACCESS_TOKEN_SIGNING_SECRET must be at least 32 bytes.');
  }

  return {
    environment: environmentName as RuntimeEnvironment,
    port: parseInteger(environment.PORT, 3000, 'PORT', 1, 65535),
    databaseUrl,
    databasePoolMax: parseInteger(
      environment.DATABASE_POOL_MAX,
      10,
      'DATABASE_POOL_MAX',
      1,
      100,
    ),
    firebaseProjectId: environment.FIREBASE_PROJECT_ID || undefined,
    accessTokenSigningSecret,
    authAccessTokenTtlSeconds: parseInteger(
      environment.AUTH_ACCESS_TOKEN_TTL_SECONDS,
      300,
      'AUTH_ACCESS_TOKEN_TTL_SECONDS',
      30,
      3600,
    ),
    authRefreshTokenTtlSeconds: parseInteger(
      environment.AUTH_REFRESH_TOKEN_TTL_SECONDS,
      2_592_000,
      'AUTH_REFRESH_TOKEN_TTL_SECONDS',
      600,
      31_536_000,
    ),
  };
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }

  return parsed;
}
