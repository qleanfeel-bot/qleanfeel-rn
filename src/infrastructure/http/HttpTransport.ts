import type { AccessTokenProvider } from '../../application/auth/ports/AccessTokenProvider';
import { SessionFailure } from '../../application/auth/SessionFailure';
import { HttpError } from './HttpError';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface HttpRequest {
  readonly method: HttpMethod;
  readonly path: string;
  readonly body?: unknown;
  readonly authenticated?: boolean;
  /** Explicit access token for the protected session logout operation only. */
  readonly bearerToken?: string;
}

export interface HttpResponse {
  readonly status: number;
  json(): Promise<unknown>;
}

export type HttpFetch = (
  url: string,
  init: {
    readonly method: HttpMethod;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: string;
  },
) => Promise<HttpResponse>;

export interface HttpTransportOptions {
  readonly baseUrl: string;
  readonly accessTokenProvider?: AccessTokenProvider;
  readonly fetchImplementation?: HttpFetch;
}

/** Provider-independent JSON transport. It never retains a token or response. */
export class HttpTransport {
  private readonly fetchImplementation: HttpFetch;

  public constructor(private readonly options: HttpTransportOptions) {
    this.fetchImplementation = options.fetchImplementation ?? defaultFetch;
  }

  public async request<T>(request: HttpRequest): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    let body: string | undefined;
    if (request.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(request.body);
    }

    let accessToken = request.bearerToken;
    if (request.authenticated) {
      let token: string | null | undefined;
      try {
        token = await this.options.accessTokenProvider?.getAccessToken();
      } catch {
        throw new HttpError('UnexpectedResponse');
      }
      accessToken = token ?? undefined;
      if (!accessToken) throw new SessionFailure('AuthenticationRequired');
    }

    let response = await this.send(request, headers, body, accessToken);
    if (
      response.status === 401 &&
      request.authenticated &&
      accessToken &&
      this.options.accessTokenProvider?.refreshAccessToken
    ) {
      try {
        const refreshedToken =
          await this.options.accessTokenProvider.refreshAccessToken(
            accessToken,
          );
        response = await this.send(request, headers, body, refreshedToken);
        if (response.status === 401) {
          await this.options.accessTokenProvider.expireAfterUnauthorized?.(
            refreshedToken,
          );
        }
      } catch (error) {
        if (error instanceof HttpError || error instanceof SessionFailure)
          throw error;
        throw new HttpError('UnexpectedResponse');
      }
    }

    if (response.status < 200 || response.status >= 300) {
      throw new HttpError(statusToCode(response.status));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new HttpError('UnexpectedResponse');
    }
  }

  private async send(
    request: HttpRequest,
    originalHeaders: Record<string, string>,
    body: string | undefined,
    accessToken?: string,
  ): Promise<HttpResponse> {
    const headers = { ...originalHeaders };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      return await this.fetchImplementation(
        `${this.options.baseUrl}${request.path}`,
        {
          method: request.method,
          headers,
          ...(body === undefined ? {} : { body }),
        },
      );
    } catch {
      throw new HttpError('NetworkError');
    }
  }
}

function statusToCode(
  status: number,
): ConstructorParameters<typeof HttpError>[0] {
  switch (status) {
    case 400:
      return 'BadRequest';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'NotFound';
    case 409:
      return 'Conflict';
    default:
      return status >= 500 ? 'ServerError' : 'UnexpectedResponse';
  }
}

const defaultFetch: HttpFetch = (url, init) => fetch(url, init);
