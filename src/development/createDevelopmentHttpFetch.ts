import type { HttpFetch } from '../infrastructure/http/HttpTransport';
import { createDevelopmentCalendarHttpFetch } from './calendar/createDevelopmentCalendarHttpFetch';
import { createDevelopmentManualOrderHttpFetch } from './manualOrder/createDevelopmentManualOrderHttpFetch';
import { createDevelopmentProfileHttpFetch } from './profile/createDevelopmentProfileHttpFetch';

const CALENDAR_COLLECTION_PATH = '/v1/me/calendar/entries';
const MANUAL_ORDER_COLLECTION_PATH = '/v1/me/manual-orders';

/** Routes development API requests to their in-memory endpoint handlers. */
export function createDevelopmentHttpFetch(): HttpFetch {
  const profileFetch = createDevelopmentProfileHttpFetch();
  const calendarEntryIds = new Set<string>();
  const manualOrderCalendarEntryIds = new Set<string>();
  const calendarFetch = createDevelopmentCalendarHttpFetch({
    isManualOrderReference: entryId => manualOrderCalendarEntryIds.has(entryId),
    onEntryCreated: entryId => calendarEntryIds.add(entryId),
    onEntryDeleted: entryId => calendarEntryIds.delete(entryId),
  });
  const manualOrderFetch = createDevelopmentManualOrderHttpFetch({
    calendarEntryExists: entryId => calendarEntryIds.has(entryId),
    onManualOrderCreated: entryId => manualOrderCalendarEntryIds.add(entryId),
  });

  return (url, init) => {
    const path = requestPath(url);
    if (path === CALENDAR_COLLECTION_PATH || path.startsWith(`${CALENDAR_COLLECTION_PATH}/`)) {
      return calendarFetch(url, init);
    }
    if (path === MANUAL_ORDER_COLLECTION_PATH || path.startsWith(`${MANUAL_ORDER_COLLECTION_PATH}/`)) {
      return manualOrderFetch(url, init);
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
