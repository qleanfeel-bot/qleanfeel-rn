import type { HttpFetch } from '../infrastructure/http/HttpTransport';
import { createDevelopmentCalendarHttpFetch } from './calendar/createDevelopmentCalendarHttpFetch';
import { createDevelopmentProfileHttpFetch } from './profile/createDevelopmentProfileHttpFetch';

const CALENDAR_COLLECTION_PATH = '/v1/me/calendar/entries';

/** Routes development API requests to their in-memory endpoint handlers. */
export function createDevelopmentHttpFetch(): HttpFetch {
  const profileFetch = createDevelopmentProfileHttpFetch();
  const calendarFetch = createDevelopmentCalendarHttpFetch();

  return (url, init) => {
    const path = requestPath(url);
    if (path === CALENDAR_COLLECTION_PATH || path.startsWith(`${CALENDAR_COLLECTION_PATH}/`)) {
      return calendarFetch(url, init);
    }
    return profileFetch(url, init);
  };
}

function requestPath(url: string): string {
  const schemeEnd = url.indexOf('://');
  const pathStart = schemeEnd < 0 ? -1 : url.indexOf('/', schemeEnd + 3);
  if (pathStart < 0) {
    return '/';
  }
  const target = url.slice(pathStart);
  const queryIndex = target.indexOf('?');
  return queryIndex < 0 ? target : target.slice(0, queryIndex);
}
