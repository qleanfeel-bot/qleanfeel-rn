/** Secure persistence for the Qleanfeel refresh credential only. */
export interface SecureTokenStore {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(refreshToken: string): Promise<void>;
  deleteRefreshToken(): Promise<void>;
}
