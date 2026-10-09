import { BadRequestException } from '@nestjs/common';
import type { ScheduleCleaningInput } from '../../application/cleanings/schedule-cleaning.js';
import type { RescheduleCleaningInput } from '../../application/cleanings/reschedule-cleaning.js';

export function readScheduleCleaningInput(
  body: unknown,
): ScheduleCleaningInput {
  const value = asRecord(body, 'A valid schedule request is required.');
  assertOnlyFields(value, new Set(['schedule', 'expectedCleaningVersion']));
  return {
    schedule: readSchedule(value.schedule),
    expectedCleaningVersion: readVersion(
      value.expectedCleaningVersion,
      'expectedCleaningVersion',
    ),
  };
}

export function readRescheduleCleaningInput(
  body: unknown,
): RescheduleCleaningInput {
  const value = asRecord(body, 'A valid reschedule request is required.');
  assertOnlyFields(
    value,
    new Set([
      'schedule',
      'expectedCleaningVersion',
      'expectedCalendarEntryVersion',
    ]),
  );
  return {
    schedule: readSchedule(value.schedule),
    expectedCleaningVersion: readVersion(
      value.expectedCleaningVersion,
      'expectedCleaningVersion',
    ),
    expectedCalendarEntryVersion: readVersion(
      value.expectedCalendarEntryVersion,
      'expectedCalendarEntryVersion',
    ),
  };
}

function readSchedule(value: unknown) {
  const schedule = asRecord(value, 'A valid schedule is required.');
  assertOnlyFields(schedule, new Set(['startAt', 'endAt']));
  return {
    startAt: requiredText(schedule.startAt, 'schedule.startAt'),
    endAt: requiredText(schedule.endAt, 'schedule.endAt'),
  };
}

function readVersion(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }
  return value;
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException(message);
  }
  return value as Record<string, unknown>;
}

function assertOnlyFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): void {
  const unknown = Object.keys(value).find(key => !allowed.has(key));
  if (unknown) throw new BadRequestException(`Unknown field: ${unknown}.`);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`${field} must be a non-empty string.`);
  }
  return value;
}
