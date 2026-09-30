import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { UserStatus } from '../../../domain/auth/entities/User';
import type { Profile } from '../../../domain/profile/entities/Profile';
import type { ProfileRepository } from '../../../domain/profile/repositories/ProfileRepository';
import { ProfileService } from '../../../application/profile/ProfileService';
import { ProfileScreen } from '../ProfileScreen';

const profile: Profile = {
  userId: 'internal-user-id',
  displayName: 'Alex Morgan',
  phone: '+1 555 0100',
  email: 'alex@example.test',
  avatar: null,
  locale: 'en',
  country: 'US',
};

function createProfileService(
  getProfile: ProfileRepository['getProfile'] = jest.fn().mockResolvedValue(profile),
) {
  const repository: jest.Mocked<ProfileRepository> = {
    getProfile: jest.fn(getProfile),
    updateDisplayName: jest.fn().mockResolvedValue(profile),
  };
  return { service: new ProfileService(repository), repository };
}

async function renderProfile(
  service: ProfileService,
  accountStatus: UserStatus = 'active',
) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ProfileScreen
        profileService={service}
        userId={profile.userId}
        accountStatus={accountStatus}
        onLogout={jest.fn()}
      />,
    );
  });
  return renderer;
}

describe('ProfileScreen', () => {
  it('shows a loading state while the profile is being retrieved', async () => {
    const { service } = createProfileService(() => new Promise(() => undefined));
    const renderer = await renderProfile(service);

    expect(renderer.root.findByProps({ testID: 'profile-loading' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Loading your profile…' })).toBeTruthy();
  });

  it('renders the loaded Profile name and contact details', async () => {
    const { service } = createProfileService();
    const renderer = await renderProfile(service);

    expect(renderer.root.findByProps({ testID: 'profile-loaded' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Alex Morgan' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: '+1 555 0100' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'alex@example.test' })).toBeTruthy();
  });

  it('shows initials when no avatar image is available', async () => {
    const { service } = createProfileService();
    const renderer = await renderProfile(service);

    expect(renderer.root.findByProps({ testID: 'profile-avatar' }).props.children.props.children)
      .toBe('A');
  });

  it('preserves the authenticated account status presentation', async () => {
    const { service } = createProfileService();
    const renderer = await renderProfile(service, 'active');

    expect(renderer.root.findByProps({ children: 'Account active' })).toBeTruthy();
  });

  it('shows an empty state when the repository has no profile', async () => {
    const { service } = createProfileService(async () => null);
    const renderer = await renderProfile(service);

    expect(renderer.root.findByProps({ testID: 'profile-missing' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Profile not found' })).toBeTruthy();
  });

  it('shows a safe error state without exposing internal exception details', async () => {
    const { service } = createProfileService(() =>
      Promise.reject(new Error('private repository stack detail')),
    );
    const renderer = await renderProfile(service);
    const output = JSON.stringify(renderer.toJSON());

    expect(renderer.root.findByProps({ testID: 'profile-error' })).toBeTruthy();
    expect(output).toContain('We couldn’t load your profile');
    expect(output).not.toContain('private repository stack detail');
  });

  it('shows Edit profile as disabled and does not invoke profile mutation', async () => {
    const { service, repository } = createProfileService();
    const renderer = await renderProfile(service);
    const editButton = renderer.root.findByProps({ testID: 'edit-profile-button' });

    expect(editButton.props.children.props.children).toBe('Edit profile');
    expect(editButton.props.disabled).toBe(true);
    expect(repository.updateDisplayName).not.toHaveBeenCalled();
  });

  it('does not render internal identity or authentication credentials', async () => {
    const { service } = createProfileService();
    const renderer = await renderProfile(service);
    const output = JSON.stringify(renderer.toJSON());

    expect(output).not.toContain(profile.userId);
    expect(output).not.toContain('Firebase');
    expect(output).not.toContain('accessToken');
    expect(output).not.toContain('refreshToken');
  });
});
