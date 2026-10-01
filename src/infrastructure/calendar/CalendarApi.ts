import { HttpTransport } from '../http/HttpTransport';
import type {
  CalendarEntriesResponseDto,
  CalendarEntryCreateRequestDto,
  CalendarEntryDto,
  CalendarEntryUpdateRequestDto,
} from './calendarDtos';

/** HTTP contract for the authenticated current user's calendar entries. */
export class CalendarApi {
  public constructor(private readonly transport: HttpTransport) {}

  public getEntries(from: string, to: string): Promise<CalendarEntriesResponseDto> {
    const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    return this.transport.request<CalendarEntriesResponseDto>({
      method: 'GET',
      path: `/v1/me/calendar/entries?${query}`,
      authenticated: true,
    });
  }

  public getEntry(entryId: string): Promise<CalendarEntryDto> {
    return this.transport.request<CalendarEntryDto>({
      method: 'GET',
      path: `/v1/me/calendar/entries/${encodeURIComponent(entryId)}`,
      authenticated: true,
    });
  }

  public createEntry(body: CalendarEntryCreateRequestDto): Promise<CalendarEntryDto> {
    return this.transport.request<CalendarEntryDto>({
      method: 'POST',
      path: '/v1/me/calendar/entries',
      body,
      authenticated: true,
    });
  }

  public updateEntry(
    entryId: string,
    body: CalendarEntryUpdateRequestDto,
  ): Promise<CalendarEntryDto> {
    return this.transport.request<CalendarEntryDto>({
      method: 'PATCH',
      path: `/v1/me/calendar/entries/${encodeURIComponent(entryId)}`,
      body,
      authenticated: true,
    });
  }

  public deleteEntry(entryId: string): Promise<void> {
    return this.transport.request<void>({
      method: 'DELETE',
      path: `/v1/me/calendar/entries/${encodeURIComponent(entryId)}`,
      authenticated: true,
    });
  }
}
