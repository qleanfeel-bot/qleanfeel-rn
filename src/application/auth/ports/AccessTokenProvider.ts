/** Supplies an opaque access token for authenticated API requests. */
export interface AccessTokenProvider {
  getAccessToken(): Promise<string | null>;
}
