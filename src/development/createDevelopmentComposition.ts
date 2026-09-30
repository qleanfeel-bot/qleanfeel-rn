import { DevelopmentAccessTokenProvider } from '../infrastructure/auth/DevelopmentAccessTokenProvider';
import { HttpTransport } from '../infrastructure/http/HttpTransport';
import { ProfileApi } from '../infrastructure/profile/ProfileApi';
import { ProfileApiRepository } from '../infrastructure/profile/ProfileApiRepository';
import { ProfileService } from '../application/profile/ProfileService';
import { CalendarApi } from '../infrastructure/calendar/CalendarApi';
import { CalendarApiRepository } from '../infrastructure/calendar/CalendarApiRepository';
import { CalendarService } from '../application/calendar/CalendarService';
import { createDevelopmentAuthController } from './auth/createDevelopmentAuthController';
import { createDevelopmentHttpFetch } from './createDevelopmentHttpFetch';

export function createDevelopmentComposition() {
  const transport = new HttpTransport({
    baseUrl: 'https://development.invalid',
    accessTokenProvider: new DevelopmentAccessTokenProvider(),
    fetchImplementation: createDevelopmentHttpFetch(),
  });
  const profileService = new ProfileService(new ProfileApiRepository(new ProfileApi(transport)));
  const calendarService = new CalendarService(new CalendarApiRepository(new CalendarApi(transport)));
  return { authController: createDevelopmentAuthController(), profileService, calendarService };
}
