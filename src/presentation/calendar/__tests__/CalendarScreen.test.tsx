import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TextInput } from 'react-native';
import { CalendarService } from '../../../application/calendar/CalendarService';
import { CreateScheduledManualOrder } from '../../../application/manualOrder/CreateScheduledManualOrder';
import { ManualOrderService } from '../../../application/manualOrder/ManualOrderService';
import { createCalendarEntry, type CalendarEntry } from '../../../domain/calendar/entities/CalendarEntry';
import type { CalendarRepository } from '../../../domain/calendar/repositories/CalendarRepository';
import type { ManualOrderRepository } from '../../../domain/manualOrder/repositories/ManualOrderRepository';
import { CalendarScreen } from '../CalendarScreen';

const entry: CalendarEntry = {
  id: 'entry-1',
  startAt: '2026-10-05T07:00:00Z',
  endAt: '2026-10-05T10:00:00Z',
  type: 'blocked',
  status: 'scheduled',
  title: 'Unavailable',
};

function createCalendarService(initialEntries: CalendarEntry[] = []) {
  let storedEntries = [...initialEntries];
  let nextId = 1;
  const repository: jest.Mocked<CalendarRepository> = {
    getEntries: jest.fn(async (_from: string, _to: string) => [...storedEntries]),
    getEntry: jest.fn(async entryId => {
      const found = storedEntries.find(candidate => candidate.id === entryId);
      if (!found) {
        throw new Error('entry not found');
      }
      return found;
    }),
    createEntry: jest.fn(async input => {
      const created = createCalendarEntry({
        id: `created-${nextId}`,
        status: 'scheduled',
        ...input,
      });
      nextId += 1;
      storedEntries = [...storedEntries, created];
      return created;
    }),
    updateEntry: jest.fn(async (entryId, changes) => {
      const existing = storedEntries.find(candidate => candidate.id === entryId);
      if (!existing) {
        throw new Error('entry not found');
      }
      const updated = createCalendarEntry({ ...existing, ...changes });
      storedEntries = storedEntries.map(candidate => candidate.id === entryId ? updated : candidate);
      return updated;
    }),
    deleteEntry: jest.fn(async entryId => {
      storedEntries = storedEntries.filter(candidate => candidate.id !== entryId);
    }),
  };
  return { service: new CalendarService(repository), repository };
}

function createManualOrderService() {
  const repository: ManualOrderRepository = {
    getOrders: jest.fn().mockResolvedValue([]),
    createOrder: jest.fn(async () => { throw new Error('not used'); }),
    getOrder: jest.fn(async () => { throw new Error('not used'); }),
  };
  return new ManualOrderService(repository);
}

async function renderCalendar(service: CalendarService, initialDate?: string) {
  const manualOrderService = createManualOrderService();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CalendarScreen
        calendarService={service}
        createScheduledManualOrder={new CreateScheduledManualOrder(service, manualOrderService)}
        initialDate={initialDate}
        manualOrderService={manualOrderService}
        onOpenOrder={jest.fn()}
        onSelectDay={jest.fn()}
      />,
    );
  });
  return renderer;
}

function control(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return renderer.root.findByProps({ testID });
}

async function press(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  await ReactTestRenderer.act(async () => {
    await control(renderer, testID).props.onPress();
  });
}

async function enterText(
  renderer: ReactTestRenderer.ReactTestRenderer,
  testID: string,
  value: string,
) {
  await ReactTestRenderer.act(async () => {
    control(renderer, testID).props.onChangeText(value);
  });
}

function localInput(daysFromToday: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string): string {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

describe('CalendarScreen', () => {
  it('shows loading while the initial request is pending and calls getEntries for a date range', async () => {
    const { service, repository } = createCalendarService();
    repository.getEntries.mockReturnValue(new Promise(() => undefined));
    const renderer = await renderCalendar(service);

    expect(control(renderer, 'calendar-loading')).toBeTruthy();
    expect(repository.getEntries).toHaveBeenCalledTimes(1);
    const [from, to] = repository.getEntries.mock.calls[0];
    expect(Date.parse(from)).toBeLessThan(Date.parse(to));
  });

  it('renders entry title, local start/end time, type, and read-only status', async () => {
    const { service } = createCalendarService([entry]);
    const renderer = await renderCalendar(service);

    expect(control(renderer, `calendar-entry-${entry.id}-title`).props.children).toBe(entry.title);
    expect(control(renderer, `calendar-entry-${entry.id}-start`).props.children.join(''))
      .toContain(new Date(entry.startAt).toLocaleString());
    expect(control(renderer, `calendar-entry-${entry.id}-end`).props.children.join(''))
      .toContain(new Date(entry.endAt).toLocaleString());
    expect(control(renderer, `calendar-entry-${entry.id}-status`).props.children.join(''))
      .toBe('Status: scheduled');
    expect(control(renderer, `calendar-entry-${entry.id}-type`).props.children.join(''))
      .toBe('Type: blocked');
  });

  it('shows the empty state when getEntries returns no entries', async () => {
    const { service } = createCalendarService();
    const renderer = await renderCalendar(service);

    expect(control(renderer, 'calendar-empty')).toBeTruthy();
    expect(JSON.stringify(renderer.toJSON())).toContain('Nothing scheduled this week');
  });

  it('starts with today identified by its date and opens the selected concrete day', async () => {
    const { service, repository } = createCalendarService();
    const onSelectDay = jest.fn();
    const manualOrderService = createManualOrderService();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <CalendarScreen
          calendarService={service}
          createScheduledManualOrder={new CreateScheduledManualOrder(service, manualOrderService)}
          manualOrderService={manualOrderService}
          onOpenOrder={jest.fn()}
          onSelectDay={onSelectDay}
        />,
      );
    });
    const today = new Date();
    const dateKey = `${String(today.getFullYear()).padStart(4, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayButton = control(renderer, `calendar-day-${dateKey}`);
    expect(todayButton.props.accessibilityLabel).toContain('Today');
    expect(todayButton.props.accessibilityState).toEqual({ selected: true });
    const [from, to] = repository.getEntries.mock.calls[0];
    expect(new Date(from).getDay()).toBe(1);
    expect(Date.parse(to) - Date.parse(from)).toBeGreaterThanOrEqual(21 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000);
    await press(renderer, `calendar-day-${dateKey}`);
    expect(onSelectDay).toHaveBeenCalledWith(dateKey);
  });

  it('month selector jumps to the week containing the chosen date', async () => {
    const { service } = createCalendarService();
    const renderer = await renderCalendar(service, '2026-10-01');
    await press(renderer, 'calendar-open-month-selector');
    await press(renderer, 'calendar-month-date-2026-10-20');
    expect(control(renderer, 'calendar-week-range').props.children).toContain('Oct 19–25');
  });

  it('changes the week period when the inner pager advances', async () => {
    const { service } = createCalendarService();
    const renderer = await renderCalendar(service, '2026-10-01');
    const pager = control(renderer, 'calendar-week-pager');

    await ReactTestRenderer.act(async () => {
      (pager.instance as { setPage: (page: number) => void }).setPage(2);
      await Promise.resolve();
    });

    expect(control(renderer, 'calendar-week-range').props.children).toContain('Oct 5–11');
  });

  it('shows a safe load error and retries the service request', async () => {
    const { service, repository } = createCalendarService([entry]);
    repository.getEntries
      .mockRejectedValueOnce(new Error('private calendar failure'))
      .mockResolvedValueOnce([entry]);
    const renderer = await renderCalendar(service);

    expect(control(renderer, 'calendar-error')).toBeTruthy();
    expect(JSON.stringify(renderer.toJSON())).not.toContain('private calendar failure');
    await press(renderer, 'calendar-retry-button');

    expect(repository.getEntries).toHaveBeenCalledTimes(2);
    expect(control(renderer, `calendar-entry-${entry.id}`)).toBeTruthy();
  });

  it('creates an entry from local date/time and refreshes the list after success', async () => {
    const { service, repository } = createCalendarService();
    const renderer = await renderCalendar(service);
    const startAt = localInput(1, 10);
    const endAt = localInput(1, 11);

    await press(renderer, 'calendar-create-button');
    await enterText(renderer, 'calendar-title-input', 'Personal time');
    await enterText(renderer, 'calendar-start-input', startAt);
    await enterText(renderer, 'calendar-end-input', endAt);
    await press(renderer, 'calendar-type-personal');
    await press(renderer, 'calendar-save-button');

    expect(repository.createEntry).toHaveBeenCalledWith({
      startAt: localInputToIso(startAt),
      endAt: localInputToIso(endAt),
      type: 'personal',
      title: 'Personal time',
    });
    expect(repository.getEntries).toHaveBeenCalledTimes(2);
    expect(renderer.root.findAllByProps({ testID: 'calendar-entry-form' })).toHaveLength(0);
    expect(control(renderer, 'calendar-entry-created-1-title').props.children).toBe('Personal time');
  });

  it('validates invalid local time input before calling createEntry', async () => {
    const { service, repository } = createCalendarService();
    const renderer = await renderCalendar(service);

    await press(renderer, 'calendar-create-button');
    await enterText(renderer, 'calendar-start-input', 'not-a-local-date');
    await press(renderer, 'calendar-save-button');

    expect(repository.createEntry).not.toHaveBeenCalled();
    expect(control(renderer, 'calendar-form-error')).toBeTruthy();
  });

  it('updates only editable fields, preserves status, and refreshes the list', async () => {
    const { service, repository } = createCalendarService([entry]);
    const renderer = await renderCalendar(service);
    const startAt = localInput(2, 9);
    const endAt = localInput(2, 10);

    await press(renderer, `calendar-edit-${entry.id}`);
    await enterText(renderer, 'calendar-title-input', 'Updated title');
    await enterText(renderer, 'calendar-start-input', startAt);
    await enterText(renderer, 'calendar-end-input', endAt);
    await press(renderer, 'calendar-type-personal');
    await press(renderer, 'calendar-save-button');

    expect(repository.updateEntry).toHaveBeenCalledWith(entry.id, {
      startAt: localInputToIso(startAt),
      endAt: localInputToIso(endAt),
      type: 'personal',
      title: 'Updated title',
    });
    const changes = repository.updateEntry.mock.calls[0][1];
    expect(Object.keys(changes).sort()).toEqual(['endAt', 'startAt', 'title', 'type']);
    expect(changes).not.toHaveProperty('id');
    expect(changes).not.toHaveProperty('status');
    expect(repository.getEntries).toHaveBeenCalledTimes(2);
    expect(control(renderer, `calendar-entry-${entry.id}-title`).props.children).toBe('Updated title');
    expect(control(renderer, `calendar-entry-${entry.id}-status`).props.children.join(''))
      .toBe('Status: scheduled');
  });

  it('shows status as read-only and does not offer a status input or selector', async () => {
    const { service } = createCalendarService([entry]);
    const renderer = await renderCalendar(service);

    expect(control(renderer, `calendar-entry-${entry.id}-status`)).toBeTruthy();
    await press(renderer, `calendar-edit-${entry.id}`);
    expect(control(renderer, 'calendar-entry-form').findAllByType(TextInput)).toHaveLength(3);
    expect(renderer.root.findAllByProps({ testID: 'calendar-type-scheduled' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'calendar-type-cancelled' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'calendar-type-completed' })).toHaveLength(0);
  });

  it('deletes an entry and reloads the list without expecting a response body', async () => {
    const { service, repository } = createCalendarService([entry]);
    const renderer = await renderCalendar(service);

    await press(renderer, `calendar-delete-${entry.id}`);

    expect(repository.deleteEntry).toHaveBeenCalledWith(entry.id);
    expect(repository.getEntries).toHaveBeenCalledTimes(2);
    expect(control(renderer, 'calendar-empty')).toBeTruthy();
  });
});
