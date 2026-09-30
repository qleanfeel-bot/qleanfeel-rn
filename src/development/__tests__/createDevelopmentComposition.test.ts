import { createDevelopmentComposition } from '../createDevelopmentComposition';

describe('development profile HTTP integration', () => {
  it('loads and updates a profile through service, repository, API, transport, and development handler', async () => {
    const { profileService } = createDevelopmentComposition();
    const userId = 'development-preview-user';

    await expect(profileService.getProfile(userId)).resolves.toMatchObject({
      userId,
      displayName: 'Qleanfeel User',
    });
    await expect(profileService.updateDisplayName(userId, '  Alex  ')).resolves.toMatchObject({
      userId,
      displayName: 'Alex',
    });
    await expect(profileService.getProfile(userId)).resolves.toMatchObject({ displayName: 'Alex' });
  });

  it('uses backend current-user semantics instead of the requested userId for authorization', async () => {
    const { profileService } = createDevelopmentComposition();
    await expect(profileService.getProfile('different-user')).rejects.toMatchObject({ code: 'UnexpectedResponse' });
  });
});
