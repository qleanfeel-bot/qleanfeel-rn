import { createCalendarEntry, type CalendarEntry } from '../../domain/calendar/entities/CalendarEntry';
import type {
  CreateCalendarEntryInput,
  UpdateCalendarEntryChanges,
} from '../../domain/calendar/repositories/CalendarRepository';
import type {
  CalendarEntryCreateRequestDto,
  CalendarEntryDto,
  CalendarEntryUpdateRequestDto,
} from './calendarDtos';

export function calendarEntryFromDto(dto: CalendarEntryDto): CalendarEntry {
  try {
    return createCalendarEntry(dto);
  } catch {
    throw { code: 'UnexpectedResponse' };
  }
}

export function calendarEntriesFromDto(response: unknown): CalendarEntry[] {
  if (
    typeof response !== 'object' ||
    response === null ||
    !('entries' in response) ||
    !Array.isArray(response.entries)
  ) {
    throw { code: 'UnexpectedResponse' };
  }

  return response.entries.map((dto: CalendarEntryDto) => calendarEntryFromDto(dto));
}

export function calendarEntryCreateRequestFromInput(
  input: CreateCalendarEntryInput,
): CalendarEntryCreateRequestDto {
  return {
    startAt: input.startAt,
    endAt: input.endAt,
    type: input.type,
    title: input.title,
  };
}

export function calendarEntryUpdateRequestFromChanges(
  changes: UpdateCalendarEntryChanges,
): CalendarEntryUpdateRequestDto {
  return {
    ...(changes.startAt === undefined ? {} : { startAt: changes.startAt }),
    ...(changes.endAt === undefined ? {} : { endAt: changes.endAt }),
    ...(changes.type === undefined ? {} : { type: changes.type }),
    ...(changes.title === undefined ? {} : { title: changes.title }),
  };
}
