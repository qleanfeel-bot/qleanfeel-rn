import * as Keychain from 'react-native-keychain';
import { KeychainSecureTokenStore } from '../KeychainSecureTokenStore';

jest.mock('react-native-keychain', () => ({
  STORAGE_TYPE: { AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth' },
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));

describe('KeychainSecureTokenStore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores, reads, replaces, and deletes only the named refresh-token entry', async () => {
    let stored: Awaited<ReturnType<typeof Keychain.getGenericPassword>> = false;
    jest
      .mocked(Keychain.getGenericPassword)
      .mockImplementation(async () => stored);
    jest
      .mocked(Keychain.setGenericPassword)
      .mockImplementation(async (username, password, options) => {
        const result = {
          service: options?.service ?? '',
          storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
        };
        stored = { ...result, username, password };
        return result;
      });
    jest.mocked(Keychain.resetGenericPassword).mockImplementation(async () => {
      stored = false;
      return true;
    });
    const store = new KeychainSecureTokenStore();

    await store.setRefreshToken('synthetic-refresh-one');
    await expect(store.getRefreshToken()).resolves.toBe(
      'synthetic-refresh-one',
    );
    await store.setRefreshToken('synthetic-refresh-two');
    await expect(store.getRefreshToken()).resolves.toBe(
      'synthetic-refresh-two',
    );
    await store.deleteRefreshToken();
    await expect(store.getRefreshToken()).resolves.toBeNull();
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'qleanfeel-refresh-token',
      'synthetic-refresh-one',
      { service: 'com.qleanfeel.app.qleanfeel-session' },
    );
    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'com.qleanfeel.app.qleanfeel-session',
    });
  });

  it('maps native storage failures without exposing native details', async () => {
    jest
      .mocked(Keychain.getGenericPassword)
      .mockRejectedValue(new Error('native secret detail'));
    const store = new KeychainSecureTokenStore();

    await expect(store.getRefreshToken()).rejects.toThrow(
      'SecureTokenStore read failed.',
    );
  });
});
