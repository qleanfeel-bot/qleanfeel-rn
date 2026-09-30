import type { Profile } from '../../../domain/profile/entities/Profile';
import type { ProfileRepository } from '../../../domain/profile/repositories/ProfileRepository';
import { ProfileService } from '../ProfileService';

const initialProfile: Profile = {
  userId: 'qleanfeel-user-1',
  displayName: 'Alex',
  phone: '+10000000000',
  email: null,
  avatar: null,
  locale: 'en',
  country: null,
};

function createRepository(): ProfileRepository {
  let profile: Profile | null = initialProfile;

  return {
    getProfile: jest.fn(async userId => (profile?.userId === userId ? profile : null)),
    updateDisplayName: jest.fn(async (userId, displayName) => {
      if (profile?.userId !== userId) {
        return null;
      }

      profile = { ...profile, displayName };
      return profile;
    }),
  };
}

describe('ProfileService', () => {
  it('retrieves an existing profile', async () => {
    const repository = createRepository();
    const service = new ProfileService(repository);

    await expect(service.getProfile(initialProfile.userId)).resolves.toEqual(initialProfile);
    expect(repository.getProfile).toHaveBeenCalledWith(initialProfile.userId);
  });

  it('updates the display name and returns the updated profile', async () => {
    const repository = createRepository();
    const service = new ProfileService(repository);

    await expect(
      service.updateDisplayName(initialProfile.userId, 'Alex Qleanfeel'),
    ).resolves.toEqual({ ...initialProfile, displayName: 'Alex Qleanfeel' });
    await expect(service.getProfile(initialProfile.userId)).resolves.toEqual({
      ...initialProfile,
      displayName: 'Alex Qleanfeel',
    });
    expect(repository.updateDisplayName).toHaveBeenCalledWith(
      initialProfile.userId,
      'Alex Qleanfeel',
    );
  });

  it('returns null when the requested profile does not exist', async () => {
    const repository = createRepository();
    const service = new ProfileService(repository);

    await expect(service.getProfile('missing-user')).resolves.toBeNull();
    await expect(service.updateDisplayName('missing-user', 'Alex')).resolves.toBeNull();
  });
});
