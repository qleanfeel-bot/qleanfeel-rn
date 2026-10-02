export interface LocalDateRange {
  readonly from: string;
  readonly to: string;
}

export function toLocalDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseLocalDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function addCalendarDays(date: Date, amount: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + amount);
  return result;
}

export function startOfCalendarWeek(date: Date): Date {
  const start = new Date(date.getTime());
  start.setHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

export function getCalendarWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
}

export function localDayRange(date: Date): LocalDateRange {
  const fromDate = new Date(date.getTime());
  fromDate.setHours(0, 0, 0, 0);
  const toDate = addCalendarDays(fromDate, 1);
  return { from: fromDate.toISOString(), to: toDate.toISOString() };
}

export function localWeekRange(weekStart: Date): LocalDateRange {
  const fromDate = new Date(weekStart.getTime());
  fromDate.setHours(0, 0, 0, 0);
  const toDate = addCalendarDays(fromDate, 7);
  return { from: fromDate.toISOString(), to: toDate.toISOString() };
}

export function formatCalendarWeek(weekStart: Date): string {
  const weekEnd = addCalendarDays(weekStart, 6);
  const startMonth = weekStart.toLocaleDateString(undefined, { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString(undefined, { month: 'short' });
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const year = weekEnd.getFullYear();
  return startMonth === endMonth
    ? `${startMonth} ${startDay}–${endDay}, ${year}`
    : `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}
