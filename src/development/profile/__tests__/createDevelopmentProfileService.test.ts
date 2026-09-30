import { createDevelopmentProfileService } from '../createDevelopmentProfileService';

describe('createDevelopmentProfileService', () => {
  it('provides an initial in-memory development profile', async () => {
    const service = createDevelopmentProfileService();

    await expect(service.getProfile('development-preview-user')).resolves.toEqual({
      userId: 'development-preview-user',
      displayName: 'Qleanfeel User',
      phone: null,
      email: null,
      avatar: null,
      locale: null,
      country: null,
    });
  });

  it('updates and subsequently returns the in-memory display name', async () => {
    const service = createDevelopmentProfileService();

    await expect(
      service.updateDisplayName('development-preview-user', 'Alex'),
    ).resolves.toMatchObject({ displayName: 'Alex' });
    await expect(service.getProfile('development-preview-user')).resolves.toMatchObject({
      displayName: 'Alex',
    });
  });

  it('returns null for another user ID on reads and updates', async () => {
    const service = createDevelopmentProfileService();

    await expect(service.getProfile('other-user')).resolves.toBeNull();
    await expect(service.updateDisplayName('other-user', 'Alex')).resolves.toBeNull();
  });
});
