import { SessionManager } from '../../application/auth/SessionManager';
import type { HttpFetch } from '../http/HttpTransport';
import { HttpTransport } from '../http/HttpTransport';
import { HttpSessionApi } from './HttpSessionApi';
import { KeychainSecureTokenStore } from './KeychainSecureTokenStore';

/** Wires real Qleanfeel session infrastructure without selecting a base URL. */
export function createSessionFoundation(options: {
  readonly baseUrl: string;
  readonly fetchImplementation?: HttpFetch;
}) {
  const sessionTransport = new HttpTransport({
    baseUrl: options.baseUrl,
    fetchImplementation: options.fetchImplementation,
  });
  const sessionManager = new SessionManager(
    new HttpSessionApi(sessionTransport),
    new KeychainSecureTokenStore(),
  );
  const authenticatedTransport = new HttpTransport({
    baseUrl: options.baseUrl,
    accessTokenProvider: sessionManager,
    fetchImplementation: options.fetchImplementation,
  });
  return { sessionManager, authenticatedTransport };
}
