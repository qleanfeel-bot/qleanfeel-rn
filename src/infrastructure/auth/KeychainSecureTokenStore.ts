import * as Keychain from 'react-native-keychain';
import type { SecureTokenStore } from '../../application/auth/ports/SecureTokenStore';

const SERVICE = 'com.qleanfeel.app.qleanfeel-session';
const ACCOUNT = 'qleanfeel-refresh-token';

/** Android native secure storage for the Qleanfeel refresh token. */
export class KeychainSecureTokenStore implements SecureTokenStore {
  public async getRefreshToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: SERVICE,
      });
      if (credentials === false) return null;
      if (
        credentials.username !== ACCOUNT ||
        credentials.password.length === 0
      ) {
        throw new Error('invalid secure entry');
      }
      return credentials.password;
    } catch {
      throw new Error('SecureTokenStore read failed.');
    }
  }

  public async setRefreshToken(refreshToken: string): Promise<void> {
    try {
      const stored = await Keychain.setGenericPassword(ACCOUNT, refreshToken, {
        service: SERVICE,
      });
      if (stored === false) throw new Error('secure write was not confirmed');
    } catch {
      throw new Error('SecureTokenStore write failed.');
    }
  }

  public async deleteRefreshToken(): Promise<void> {
    try {
      const deleted = await Keychain.resetGenericPassword({ service: SERVICE });
      if (
        !deleted &&
        (await Keychain.getGenericPassword({ service: SERVICE })) !== false
      ) {
        throw new Error('secure entry remains');
      }
    } catch {
      throw new Error('SecureTokenStore deletion failed.');
    }
  }
}
