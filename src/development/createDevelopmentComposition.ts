import { DevelopmentAccessTokenProvider } from '../infrastructure/auth/DevelopmentAccessTokenProvider';
import { HttpTransport } from '../infrastructure/http/HttpTransport';
import { ProfileApi } from '../infrastructure/profile/ProfileApi';
import { ProfileApiRepository } from '../infrastructure/profile/ProfileApiRepository';
import { ProfileService } from '../application/profile/ProfileService';
import { createDevelopmentAuthController } from './auth/createDevelopmentAuthController';
import { createDevelopmentProfileHttpFetch } from './profile/createDevelopmentProfileHttpFetch';

export function createDevelopmentComposition() {
  const transport = new HttpTransport({
    baseUrl: 'https://development.invalid',
    accessTokenProvider: new DevelopmentAccessTokenProvider(),
    fetchImplementation: createDevelopmentProfileHttpFetch(),
  });
  const profileService = new ProfileService(new ProfileApiRepository(new ProfileApi(transport)));
  return { authController: createDevelopmentAuthController(), profileService };
}
