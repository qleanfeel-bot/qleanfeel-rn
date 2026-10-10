import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import { KeychainSpikeScreen } from '../KeychainSpikeScreen';

jest.mock('react-native-keychain', () => ({
  STORAGE_TYPE: { AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth' },
  getGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
}));

const mockedKeychain = jest.mocked(Keychain);

async function renderScreen() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<KeychainSpikeScreen />);
  });
  return renderer;
}

function button(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return renderer.root.findByProps({ testID });
}

describe('KeychainSpikeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedKeychain.getGenericPassword.mockResolvedValue(false);
    mockedKeychain.setGenericPassword.mockResolvedValue({
      service: 'com.qleanfeel.development.m8-b0-keychain-spike',
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });
    mockedKeychain.resetGenericPassword.mockResolvedValue(true);
  });

  it('writes, reads, replaces, deletes, and reports only verification status', async () => {
    const renderer = await renderScreen();

    mockedKeychain.getGenericPassword
      .mockResolvedValueOnce({
        username: 'synthetic-spike-value',
        password: 'm8-b0-spike-value-v1',
        service: 'com.qleanfeel.development.m8-b0-keychain-spike',
        storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
      })
      .mockResolvedValueOnce({
        username: 'synthetic-spike-value',
        password: 'm8-b0-spike-value-v1',
        service: 'com.qleanfeel.development.m8-b0-keychain-spike',
        storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
      })
      .mockResolvedValueOnce({
        username: 'synthetic-spike-value',
        password: 'm8-b0-spike-value-v2',
        service: 'com.qleanfeel.development.m8-b0-keychain-spike',
        storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
      })
      .mockResolvedValueOnce(false);

    await ReactTestRenderer.act(async () =>
      button(renderer, 'keychain-write').props.onPress(),
    );
    expect(mockedKeychain.setGenericPassword).toHaveBeenCalledWith(
      'synthetic-spike-value',
      'm8-b0-spike-value-v1',
      { service: 'com.qleanfeel.development.m8-b0-keychain-spike' },
    );
    expect(
      renderer.root.findByProps({ testID: 'keychain-spike-result' }).props
        .children,
    ).toContain('Write verified');

    await ReactTestRenderer.act(async () =>
      button(renderer, 'keychain-read').props.onPress(),
    );
    expect(
      renderer.root.findByProps({ testID: 'keychain-spike-result' }).props
        .children,
    ).toContain('Read verified');

    await ReactTestRenderer.act(async () =>
      button(renderer, 'keychain-replace').props.onPress(),
    );
    expect(mockedKeychain.setGenericPassword).toHaveBeenLastCalledWith(
      'synthetic-spike-value',
      'm8-b0-spike-value-v2',
      { service: 'com.qleanfeel.development.m8-b0-keychain-spike' },
    );
    expect(
      renderer.root.findByProps({ testID: 'keychain-spike-result' }).props
        .children,
    ).toContain('Replace verified');

    await ReactTestRenderer.act(async () =>
      button(renderer, 'keychain-delete').props.onPress(),
    );
    expect(mockedKeychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'com.qleanfeel.development.m8-b0-keychain-spike',
    });
    expect(
      renderer.root.findByProps({ testID: 'keychain-spike-result' }).props
        .children,
    ).toContain('Delete verified');
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      'm8-b0-spike-value-v1',
    );
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      'm8-b0-spike-value-v2',
    );
  });

  it('shows a safe status if native storage rejects an operation', async () => {
    mockedKeychain.getGenericPassword.mockRejectedValueOnce(
      new Error('private native error'),
    );
    const renderer = await renderScreen();

    expect(
      renderer.root.findByProps({ testID: 'keychain-spike-result' }).props
        .children,
    ).toContain('Storage operation failed');
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      'private native error',
    );
  });
});
