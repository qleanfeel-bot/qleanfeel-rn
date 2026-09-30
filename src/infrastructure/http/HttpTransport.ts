import type { AccessTokenProvider } from '../../application/auth/ports/AccessTokenProvider';
import { HttpError } from './HttpError';

export type HttpMethod = 'GET' | 'PATCH';

export interface HttpRequest {
  readonly method: HttpMethod;
  readonly path: string;
  readonly body?: unknown;
  readonly authenticated?: boolean;
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

    if (request.authenticated) {
      let token: string | null | undefined;
      try {
        token = await this.options.accessTokenProvider?.getAccessToken();
      } catch {
        throw new HttpError('UnexpectedResponse');
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    let response: HttpResponse;
    try {
      response = await this.fetchImplementation(`${this.options.baseUrl}${request.path}`, {
        method: request.method,
        headers,
        ...(body === undefined ? {} : { body }),
      });
    } catch {
      throw new HttpError('NetworkError');
    }

    if (response.status < 200 || response.status >= 300) {
      throw new HttpError(statusToCode(response.status));
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new HttpError('UnexpectedResponse');
    }
  }
}

function statusToCode(status: number): ConstructorParameters<typeof HttpError>[0] {
  switch (status) {
    case 400:
      return 'BadRequest';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'NotFound';
    default:
      return status >= 500 ? 'ServerError' : 'UnexpectedResponse';
  }
}

const defaultFetch: HttpFetch = (url, init) => fetch(url, init);
