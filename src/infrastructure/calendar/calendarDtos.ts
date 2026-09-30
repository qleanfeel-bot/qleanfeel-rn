export interface CalendarEntryDto {
  readonly id: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly type: string;
  readonly status: string;
  readonly title: string;
}

export interface CalendarEntriesResponseDto {
  readonly entries: CalendarEntryDto[];
}

export interface CalendarEntryCreateRequestDto {
  readonly startAt: string;
  readonly endAt: string;
  readonly type: string;
  readonly title: string;
}

export interface CalendarEntryUpdateRequestDto {
  readonly startAt?: string;
  readonly endAt?: string;
  readonly type?: string;
  readonly title?: string;
}
