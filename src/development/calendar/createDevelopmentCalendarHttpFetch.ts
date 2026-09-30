import { createCalendarEntry, type CalendarEntry } from '../../domain/calendar/entities/CalendarEntry';
import type { HttpFetch, HttpResponse } from '../../infrastructure/http/HttpTransport';

const COLLECTION_PATH = '/v1/me/calendar/entries';
const DEVELOPMENT_AUTHORIZATION = 'Bearer development-api-access-token';
const CREATE_FIELDS = ['startAt', 'endAt', 'type', 'title'];
const UPDATE_FIELDS = ['startAt', 'endAt', 'type', 'title'];

type CalendarErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'ENTRY_NOT_FOUND'
  | 'CALENDAR_CONFLICT'
  | 'INTERNAL_ERROR';

type CalendarErrorStatus = 400 | 401 | 403 | 404 | 409 | 500;

/** Development-only in-memory handler for the Calendar HTTP API. */
export function createDevelopmentCalendarHttpFetch(): HttpFetch {
  const seed = createCalendarEntry({
    id: 'development-calendar-seed',
    startAt: '2026-10-05T07:00:00Z',
    endAt: '2026-10-05T10:00:00Z',
    type: 'personal',
    status: 'scheduled',
    title: 'Development calendar sample',
  });
  const entries = new Map<string, CalendarEntry>([[seed.id, seed]]);
  let nextEntryId = 1;

  return async (url, init) => {
    try {
      const target = requestTarget(url);
      const queryIndex = target.indexOf('?');
      const path = queryIndex < 0 ? target : target.slice(0, queryIndex);
      const query = queryIndex < 0 ? '' : target.slice(queryIndex + 1);
      const isCollection = path === COLLECTION_PATH;
      const encodedEntryId = path.startsWith(`${COLLECTION_PATH}/`)
        ? path.slice(COLLECTION_PATH.length + 1)
        : '';
      const isEntry = encodedEntryId.length > 0 && !encodedEntryId.includes('/');

      if (!isCollection && !isEntry) {
        return errorResponse(404, 'ENTRY_NOT_FOUND');
      }
      if (init.headers.Authorization !== DEVELOPMENT_AUTHORIZATION) {
        return errorResponse(401, 'UNAUTHORIZED');
      }

      if (isCollection && init.method === 'GET') {
        return getEntries(query, entries);
      }
      if (isCollection && init.method === 'POST') {
        if (query) {
          return errorResponse(400, 'VALIDATION_ERROR');
        }
        const created = createEntry(init.body, nextEntryId);
        if (created === null) {
          return errorResponse(400, 'VALIDATION_ERROR');
        }
        entries.set(created.id, created);
        nextEntryId += 1;
        return response(201, created);
      }
      if (isEntry) {
        let entryId: string;
        try {
          entryId = decodeURIComponent(encodedEntryId);
        } catch {
          return errorResponse(404, 'ENTRY_NOT_FOUND');
        }

        if (init.method === 'PATCH') {
          if (query) {
            return errorResponse(400, 'VALIDATION_ERROR');
          }
          return updateEntry(entryId, init.body, entries);
        }
        if (init.method === 'DELETE') {
          if (query) {
            return errorResponse(400, 'VALIDATION_ERROR');
          }
          if (!entries.delete(entryId)) {
            return errorResponse(404, 'ENTRY_NOT_FOUND');
          }
          return response(204);
        }
      }

      return errorResponse(404, 'ENTRY_NOT_FOUND');
    } catch {
      return errorResponse(500, 'INTERNAL_ERROR');
    }
  };
}

function getEntries(query: string, entries: Map<string, CalendarEntry>): HttpResponse {
  const values = parseQuery(query);
  if (
    values === null ||
    Object.keys(values).length !== 2 ||
    typeof values.from !== 'string' ||
    typeof values.to !== 'string' ||
    !isValidRange(values.from, values.to)
  ) {
    return errorResponse(400, 'VALIDATION_ERROR');
  }

  const matches = [...entries.values()].filter(entry =>
    compareUtcInstants(entry.startAt, values.to) < 0 &&
    compareUtcInstants(values.from, entry.endAt) < 0,
  );
  return response(200, { entries: matches });
}

function createEntry(body: string | undefined, sequence: number): CalendarEntry | null {
  const input = parseBody(body);
  if (
    !isRecord(input) ||
    !hasExactFields(input, CREATE_FIELDS) ||
    typeof input.startAt !== 'string' ||
    typeof input.endAt !== 'string' ||
    typeof input.type !== 'string' ||
    typeof input.title !== 'string'
  ) {
    return null;
  }

  try {
    return createCalendarEntry({
      id: `development-calendar-entry-${sequence}`,
      startAt: input.startAt,
      endAt: input.endAt,
      type: input.type,
      status: 'scheduled',
      title: input.title,
    });
  } catch {
    return null;
  }
}

function updateEntry(
  entryId: string,
  body: string | undefined,
  entries: Map<string, CalendarEntry>,
): HttpResponse {
  const existing = entries.get(entryId);
  if (!existing) {
    return errorResponse(404, 'ENTRY_NOT_FOUND');
  }

  const changes = parseBody(body);
  if (!isRecord(changes) || Object.keys(changes).some(field => !UPDATE_FIELDS.includes(field))) {
    return errorResponse(400, 'VALIDATION_ERROR');
  }
  if (Object.values(changes).some(value => typeof value !== 'string')) {
    return errorResponse(400, 'VALIDATION_ERROR');
  }

  try {
    const updated = createCalendarEntry({ ...existing, ...changes });
    entries.set(entryId, updated);
    return response(200, updated);
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR');
  }
}

function isValidRange(from: string, to: string): boolean {
  try {
    createCalendarEntry({
      id: 'range-validation',
      startAt: from,
      endAt: to,
      type: 'blocked',
      status: 'scheduled',
      title: '',
    });
    return true;
  } catch {
    return false;
  }
}

function compareUtcInstants(left: string, right: string): number {
  const leftWholeSecond = Date.parse(left.replace(/\.\d+Z$/, 'Z'));
  const rightWholeSecond = Date.parse(right.replace(/\.\d+Z$/, 'Z'));
  if (leftWholeSecond !== rightWholeSecond) {
    return leftWholeSecond < rightWholeSecond ? -1 : 1;
  }

  const leftFraction = /\.(\d+)Z$/.exec(left)?.[1] ?? '';
  const rightFraction = /\.(\d+)Z$/.exec(right)?.[1] ?? '';
  const precision = Math.max(leftFraction.length, rightFraction.length);
  for (let index = 0; index < precision; index += 1) {
    const leftDigit = leftFraction.charCodeAt(index) || 48;
    const rightDigit = rightFraction.charCodeAt(index) || 48;
    if (leftDigit !== rightDigit) {
      return leftDigit < rightDigit ? -1 : 1;
    }
  }

  return 0;
}

function parseQuery(query: string): Record<string, string> | null {
  if (!query) {
    return {};
  }

  const values: Record<string, string> = {};
  try {
    for (const pair of query.split('&')) {
      const separator = pair.indexOf('=');
      if (separator < 0) {
        return null;
      }
      const key = decodeURIComponent(pair.slice(0, separator).replace(/\+/g, ' '));
      const value = decodeURIComponent(pair.slice(separator + 1).replace(/\+/g, ' '));
      if (key in values) {
        return null;
      }
      values[key] = value;
    }
  } catch {
    return null;
  }

  return values;
}

function parseBody(body: string | undefined): unknown {
  try {
    return JSON.parse(body ?? '');
  } catch {
    return null;
  }
}

function hasExactFields(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).length === expected.length &&
    Object.keys(value).every(field => expected.includes(field));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requestTarget(url: string): string {
  const schemeEnd = url.indexOf('://');
  const pathStart = schemeEnd < 0 ? -1 : url.indexOf('/', schemeEnd + 3);
  return pathStart < 0 ? '/' : url.slice(pathStart);
}

function errorResponse(status: CalendarErrorStatus, code: CalendarErrorCode): HttpResponse {
  const messages: Record<CalendarErrorCode, string> = {
    VALIDATION_ERROR: 'Calendar interval is invalid.',
    UNAUTHORIZED: 'Authentication is required.',
    FORBIDDEN: 'Calendar access is not permitted.',
    ENTRY_NOT_FOUND: 'Calendar entry was not found.',
    CALENDAR_CONFLICT: 'Calendar operation conflicts with existing state.',
    INTERNAL_ERROR: 'An unexpected error occurred.',
  };
  return response(status, { error: { code, message: messages[code] } });
}

function response(status: number, body?: unknown): HttpResponse {
  return { status, json: async () => body };
}
