import type { CalendarEntry } from '../../domain/calendar/entities/CalendarEntry';
import type {
  CalendarRepository,
  CreateCalendarEntryInput,
  UpdateCalendarEntryChanges,
} from '../../domain/calendar/repositories/CalendarRepository';
import { HttpError } from '../http/HttpError';
import { CalendarApi } from './CalendarApi';
import {
  calendarEntriesFromDto,
  calendarEntryCreateRequestFromInput,
  calendarEntryFromDto,
  calendarEntryUpdateRequestFromChanges,
} from './calendarMappers';

/** Adapts the calendar API to its provider-independent repository contract. */
export class CalendarApiRepository implements CalendarRepository {
  public constructor(private readonly api: CalendarApi) {}

  public async getEntries(from: string, to: string): Promise<CalendarEntry[]> {
    try {
      return calendarEntriesFromDto(await this.api.getEntries(from, to));
    } catch (error) {
      throw toRepositoryError(error);
    }
  }

  public async createEntry(entry: CreateCalendarEntryInput): Promise<CalendarEntry> {
    try {
      const request = calendarEntryCreateRequestFromInput(entry);
      return calendarEntryFromDto(await this.api.createEntry(request));
    } catch (error) {
      throw toRepositoryError(error);
    }
  }

  public async updateEntry(
    entryId: string,
    changes: UpdateCalendarEntryChanges,
  ): Promise<CalendarEntry> {
    try {
      const request = calendarEntryUpdateRequestFromChanges(changes);
      return calendarEntryFromDto(await this.api.updateEntry(entryId, request));
    } catch (error) {
      throw toRepositoryError(error, true);
    }
  }

  public async deleteEntry(entryId: string): Promise<void> {
    try {
      await this.api.deleteEntry(entryId);
    } catch (error) {
      throw toRepositoryError(error, true);
    }
  }
}

function toRepositoryError(error: unknown, entryMayBeMissing = false): { readonly code: string } {
  if (error instanceof HttpError) {
    switch (error.code) {
      case 'BadRequest':
        return { code: 'ValidationError' };
      case 'Unauthorized':
        return { code: 'Unauthorized' };
      case 'Forbidden':
        return { code: 'Forbidden' };
      case 'NotFound':
        return { code: entryMayBeMissing ? 'EntryNotFound' : 'UnexpectedResponse' };
      case 'Conflict':
        return { code: 'CalendarConflict' };
      case 'ServerError':
        return { code: 'ServerError' };
      case 'NetworkError':
        return { code: 'NetworkError' };
      case 'UnexpectedResponse':
        return { code: 'UnexpectedResponse' };
    }
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { readonly code: unknown }).code;
    if (code === 'UnexpectedResponse') {
      return { code };
    }
  }

  return { code: 'UnexpectedResponse' };
}
