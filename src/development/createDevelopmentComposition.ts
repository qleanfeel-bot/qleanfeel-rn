import { SessionManager } from '../application/auth/SessionManager';
import { DevelopmentAccessTokenProvider } from '../infrastructure/auth/DevelopmentAccessTokenProvider';
import { HttpTransport } from '../infrastructure/http/HttpTransport';
import { ProfileApi } from '../infrastructure/profile/ProfileApi';
import { ProfileApiRepository } from '../infrastructure/profile/ProfileApiRepository';
import { ProfileService } from '../application/profile/ProfileService';
import { CalendarApi } from '../infrastructure/calendar/CalendarApi';
import { CalendarApiRepository } from '../infrastructure/calendar/CalendarApiRepository';
import { CalendarService } from '../application/calendar/CalendarService';
import { ManualOrderService } from '../application/manualOrder/ManualOrderService';
import { CreateScheduledManualOrder } from '../application/manualOrder/CreateScheduledManualOrder';
import { ManualOrderApi } from '../infrastructure/manualOrder/ManualOrderApi';
import { ManualOrderApiRepository } from '../infrastructure/manualOrder/ManualOrderApiRepository';
import { createDevelopmentAuthController } from './auth/createDevelopmentAuthController';
import { createDevelopmentHttpFetch } from './createDevelopmentHttpFetch';
import { DevelopmentSessionApi } from './auth/DevelopmentSessionApi';
import { InMemorySecureTokenStore } from './auth/InMemorySecureTokenStore';

export function createDevelopmentComposition() {
  const sessionManager = new SessionManager(
    new DevelopmentSessionApi(),
    new InMemorySecureTokenStore(),
  );
  const transport = new HttpTransport({
    baseUrl: 'https://development.invalid',
    accessTokenProvider: new DevelopmentAccessTokenProvider(),
    fetchImplementation: createDevelopmentHttpFetch(),
  });
  const profileService = new ProfileService(
    new ProfileApiRepository(new ProfileApi(transport)),
  );
  const calendarService = new CalendarService(
    new CalendarApiRepository(new CalendarApi(transport)),
  );
  const manualOrderService = new ManualOrderService(
    new ManualOrderApiRepository(new ManualOrderApi(transport)),
  );
  const createScheduledManualOrder = new CreateScheduledManualOrder(
    calendarService,
    manualOrderService,
  );
  return {
    authController: createDevelopmentAuthController(sessionManager),
    sessionManager,
    profileService,
    calendarService,
    manualOrderService,
    createScheduledManualOrder,
  };
}
