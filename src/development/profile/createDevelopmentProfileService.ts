import type { Profile } from '../../domain/profile/entities/Profile';
import type { ProfileRepository } from '../../domain/profile/repositories/ProfileRepository';
import { ProfileService } from '../../application/profile/ProfileService';

const developmentUserId = 'development-preview-user';

/** In-memory preview data only; this is not production profile persistence. */
export function createDevelopmentProfileService(): ProfileService {
  const profile: Profile = {
    userId: developmentUserId,
    displayName: 'Qleanfeel User',
    phone: null,
    email: null,
    avatar: null,
    locale: null,
    country: null,
  };

  const repository: ProfileRepository = {
    getProfile: async userId => (userId === developmentUserId ? profile : null),
    updateDisplayName: async () => {
      throw new Error('Profile editing is not available in the development preview.');
    },
  };

  return new ProfileService(repository);
}
