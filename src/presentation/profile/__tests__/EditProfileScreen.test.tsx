import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import type { Profile } from '../../../domain/profile/entities/Profile';
import type { ProfileRepository } from '../../../domain/profile/repositories/ProfileRepository';
import { ProfileService } from '../../../application/profile/ProfileService';
import { EditProfileScreen } from '../EditProfileScreen';

const profile: Profile = {
  userId: 'internal-user-id',
  displayName: 'Qleanfeel User',
  phone: '+7 900 000-00-00',
  email: 'user@example.test',
  avatar: null,
  locale: null,
  country: null,
};

function createProfileService() {
  const repository: jest.Mocked<ProfileRepository> = {
    getProfile: jest.fn().mockResolvedValue(profile),
    updateDisplayName: jest.fn().mockResolvedValue(profile),
  };
  return { service: new ProfileService(repository), repository };
}

async function renderEditProfile(
  service: ProfileService,
  onSaved = jest.fn(),
  onCancel = jest.fn(),
) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <EditProfileScreen
        profileService={service}
        userId={profile.userId}
        profile={profile}
        onSaved={onSaved}
        onCancel={onCancel}
      />,
    );
  });
  return { renderer, onSaved, onCancel };
}

function input(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findByProps({ testID: 'display-name-input' });
}

function saveButton(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findByProps({ testID: 'save-profile-button' });
}

describe('EditProfileScreen', () => {
  it('starts with the current display name in the editable input', async () => {
    const { service } = createProfileService();
    const { renderer } = await renderEditProfile(service);

    expect(input(renderer).props.value).toBe('Qleanfeel User');
    expect(renderer.root.findByProps({ children: 'Edit profile' })).toBeTruthy();
  });

  it('renders phone and email as read-only text', async () => {
    const { service } = createProfileService();
    const { renderer } = await renderEditProfile(service);
    const textInputs = renderer.root.findAllByType(TextInput);

    expect(textInputs).toHaveLength(1);
    expect(renderer.root.findByProps({ children: '+7 900 000-00-00' }).type).toBe(Text);
    expect(renderer.root.findByProps({ children: 'user@example.test' }).type).toBe(Text);
  });

  it('renders an enabled Save action', async () => {
    const { service } = createProfileService();
    const { renderer } = await renderEditProfile(service);

    expect(saveButton(renderer).props.disabled).toBe(false);
    expect(renderer.root.findByProps({ testID: 'cancel-profile-button' })).toBeTruthy();
  });

  it.each(['', '   \t  '])('rejects an empty or whitespace-only name (%j)', async value => {
    const { service, repository } = createProfileService();
    const { renderer } = await renderEditProfile(service);
    await ReactTestRenderer.act(async () => input(renderer).props.onChangeText(value));
    await ReactTestRenderer.act(async () => saveButton(renderer).props.onPress());

    expect(renderer.root.findByProps({ testID: 'display-name-error' }).props.children).toBe(
      'Please enter your name.',
    );
    expect(repository.updateDisplayName).not.toHaveBeenCalled();
  });

  it('trims the display name before passing it to ProfileService', async () => {
    const { service, repository } = createProfileService();
    const updatedProfile = { ...profile, displayName: 'Alex' };
    repository.updateDisplayName.mockResolvedValue(updatedProfile);
    const { renderer, onSaved } = await renderEditProfile(service);
    await ReactTestRenderer.act(async () => input(renderer).props.onChangeText('  Alex  '));
    await ReactTestRenderer.act(async () => saveButton(renderer).props.onPress());

    expect(repository.updateDisplayName).toHaveBeenCalledWith(profile.userId, 'Alex');
    expect(onSaved).toHaveBeenCalledWith(updatedProfile);
  });

  it('limits the input to a reasonable maximum display name length', async () => {
    const { service } = createProfileService();
    const { renderer } = await renderEditProfile(service);

    expect(input(renderer).props.maxLength).toBe(80);
    await ReactTestRenderer.act(async () => input(renderer).props.onChangeText('A'.repeat(5000)));
    expect(input(renderer).props.value).toHaveLength(80);
  });

  it('shows Saving, disables Save, and prevents duplicate mutation while pending', async () => {
    const { service, repository } = createProfileService();
    let finishSave!: (value: Profile | null) => void;
    repository.updateDisplayName.mockReturnValue(
      new Promise(resolve => {
        finishSave = resolve;
      }),
    );
    const { renderer } = await renderEditProfile(service);
    let pendingSave!: Promise<void>;
    await ReactTestRenderer.act(async () => {
      pendingSave = saveButton(renderer).props.onPress();
      await Promise.resolve();
    });

    expect(saveButton(renderer).props.disabled).toBe(true);
    expect(saveButton(renderer).findByType(Text).props.children).toBe('Saving…');
    await ReactTestRenderer.act(async () => {
      await saveButton(renderer).props.onPress();
    });
    expect(repository.updateDisplayName).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => {
      finishSave({ ...profile, displayName: 'Qleanfeel User' });
      await pendingSave;
    });
  });

  it('calls onSaved with the updated profile after success', async () => {
    const { service, repository } = createProfileService();
    const updatedProfile = { ...profile, displayName: 'Alex' };
    repository.updateDisplayName.mockResolvedValue(updatedProfile);
    const { renderer, onSaved } = await renderEditProfile(service);
    await ReactTestRenderer.act(async () => input(renderer).props.onChangeText('Alex'));
    await ReactTestRenderer.act(async () => saveButton(renderer).props.onPress());

    expect(onSaved).toHaveBeenCalledWith(updatedProfile);
  });

  it('stays on the screen and preserves the draft after a save error', async () => {
    const { service, repository } = createProfileService();
    repository.updateDisplayName.mockRejectedValue(new Error('private database stack detail'));
    const { renderer } = await renderEditProfile(service);
    await ReactTestRenderer.act(async () => input(renderer).props.onChangeText('Draft name'));
    await ReactTestRenderer.act(async () => saveButton(renderer).props.onPress());

    const output = JSON.stringify(renderer.toJSON());
    expect(renderer.root.findByProps({ testID: 'edit-profile-screen' })).toBeTruthy();
    expect(input(renderer).props.value).toBe('Draft name');
    expect(renderer.root.findByProps({ testID: 'profile-save-error' }).props.children).toBe(
      "We couldn't save your profile. Please try again.",
    );
    expect(output).not.toContain('private database stack detail');
  });

  it('returns through onCancel without changing the source profile', async () => {
    const { service, repository } = createProfileService();
    const { renderer, onCancel } = await renderEditProfile(service);
    await ReactTestRenderer.act(async () => input(renderer).props.onChangeText('Unsaved draft'));
    await ReactTestRenderer.act(async () =>
      renderer.root.findByProps({ testID: 'cancel-profile-button' }).props.onPress(),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(repository.updateDisplayName).not.toHaveBeenCalled();
    expect(profile.displayName).toBe('Qleanfeel User');
  });

  it('does not mutate the original profile before successful save', async () => {
    const { service, repository } = createProfileService();
    const { renderer } = await renderEditProfile(service);
    await ReactTestRenderer.act(async () => input(renderer).props.onChangeText('Alex'));

    expect(profile.displayName).toBe('Qleanfeel User');
    expect(repository.updateDisplayName).not.toHaveBeenCalled();
  });
});
