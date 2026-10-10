/** Supplies an opaque access token for authenticated API requests. */
export interface AccessTokenProvider {
  getAccessToken(): Promise<string | null>;
  /** Optional session hook used once after an authenticated request receives 401. */
  refreshAccessToken?(failedAccessToken: string): Promise<string>;
  /** Clears a session after the one permitted retry is also unauthorized. */
  expireAfterUnauthorized?(accessToken: string): Promise<void>;
}
