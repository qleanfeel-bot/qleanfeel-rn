import type { User, UserStatus } from '../../domain/auth/entities/User';
import type { ProviderCredential } from '../../application/auth/ProviderCredential';
import type {
  QleanfeelSessionCredentials,
  SessionApi,
} from '../../application/auth/ports/SessionApi';
import { HttpTransport } from '../http/HttpTransport';
import { HttpError } from '../http/HttpError';

interface SessionResponseDto {
  readonly user: {
    readonly id: string;
    readonly status: UserStatus;
    readonly createdAt: string;
    readonly updatedAt?: string;
  };
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: 'Bearer';
}

/** HTTP adapter for Qleanfeel session routes; Firebase SDK types do not enter here. */
export class HttpSessionApi implements SessionApi {
  public constructor(private readonly transport: HttpTransport) {}

  public async bootstrap(
    providerCredential: ProviderCredential,
  ): Promise<QleanfeelSessionCredentials> {
    const response = await this.transport.request<unknown>({
      method: 'POST',
      path: '/v1/auth/bootstrap',
      body: { firebaseIdToken: providerCredential },
    });
    return parseSessionResponse(response);
  }

  public async refresh(
    refreshToken: string,
  ): Promise<QleanfeelSessionCredentials> {
    const response = await this.transport.request<unknown>({
      method: 'POST',
      path: '/v1/auth/refresh',
      body: { refreshToken },
    });
    return parseSessionResponse(response);
  }

  public async logout(accessToken: string): Promise<void> {
    await this.transport.request<void>({
      method: 'POST',
      path: '/v1/auth/logout',
      bearerToken: accessToken,
    });
  }
}

function parseSessionResponse(value: unknown): QleanfeelSessionCredentials {
  if (!isRecord(value) || !isRecord(value.user)) {
    throw new HttpError('UnexpectedResponse');
  }
  const { user, accessToken, refreshToken, tokenType } =
    value as unknown as SessionResponseDto;
  const createdAt = parseDate(user.createdAt);
  const updatedAt =
    user.updatedAt === undefined ? undefined : parseDate(user.updatedAt);
  if (
    typeof user.id !== 'string' ||
    (user.status !== 'active' && user.status !== 'suspended') ||
    !createdAt ||
    (user.updatedAt !== undefined && !updatedAt) ||
    typeof accessToken !== 'string' ||
    accessToken.length === 0 ||
    typeof refreshToken !== 'string' ||
    refreshToken.length === 0 ||
    tokenType !== 'Bearer'
  ) {
    throw new HttpError('UnexpectedResponse');
  }

  const mappedUser: User = {
    id: user.id,
    status: user.status,
    createdAt,
    ...(updatedAt ? { updatedAt } : {}),
  };
  return { user: mappedUser, accessToken, refreshToken };
}

function parseDate(value: string): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
