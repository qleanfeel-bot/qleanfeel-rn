import { createDevelopmentComposition } from '../createDevelopmentComposition';

describe('development profile HTTP integration', () => {
  it('trims a padded display name through the service, repository, API, transport, and development handler', async () => {
    const { profileService } = createDevelopmentComposition();
    const userId = 'development-preview-user';

    await expect(profileService.getProfile(userId)).resolves.toMatchObject({
      userId,
      displayName: 'Qleanfeel User',
    });
    await expect(profileService.updateDisplayName(userId, '  Alex  ')).resolves.toMatchObject({
      userId,
      displayName: 'Alex',
    });
    await expect(profileService.getProfile(userId)).resolves.toMatchObject({ displayName: 'Alex' });
  });

  it('uses backend current-user semantics instead of the requested userId for authorization', async () => {
    const { profileService } = createDevelopmentComposition();
    await expect(profileService.getProfile('different-user')).rejects.toMatchObject({ code: 'UnexpectedResponse' });
  });
});

describe('development calendar HTTP integration', () => {
  it('creates, reads, updates, and deletes through the complete development composition', async () => {
    const { calendarService } = createDevelopmentComposition();
    const from = '2026-10-10T00:00:00Z';
    const to = '2026-10-11T00:00:00Z';
    const created = await calendarService.createEntry({
      startAt: '2026-10-10T07:00:00Z',
      endAt: '2026-10-10T09:00:00Z',
      type: 'blocked',
      title: 'Unavailable',
    });

    expect(created).toMatchObject({
      id: 'development-calendar-entry-1',
      status: 'scheduled',
      title: 'Unavailable',
    });
    await expect(calendarService.getEntries(from, to)).resolves.toEqual([created]);

    const updated = await calendarService.updateEntry(created.id, {
      startAt: '2026-10-10T08:00:00Z',
      title: '',
    });
    expect(updated).toMatchObject({ startAt: '2026-10-10T08:00:00Z', title: '' });
    await expect(calendarService.getEntries(from, to)).resolves.toEqual([updated]);

    await expect(calendarService.deleteEntry(created.id)).resolves.toBeUndefined();
    await expect(calendarService.getEntries(from, to)).resolves.toEqual([]);
  });

  it('reads a CalendarEntry by id through service, API repository, transport, and handler', async () => {
    const { calendarService } = createDevelopmentComposition();
    await expect(calendarService.getEntry('development-calendar-seed')).resolves.toMatchObject({
      id: 'development-calendar-seed',
      type: 'personal',
    });
    await expect(calendarService.getEntry('missing')).rejects.toEqual({ code: 'EntryNotFound' });
  });
});

describe('development ManualOrder HTTP integration', () => {
  it('creates a scheduled order, then reads the order and its separately stored CalendarEntry', async () => {
    const { manualOrderService, createScheduledManualOrder, calendarService } = createDevelopmentComposition();
    const created = await createScheduledManualOrder.execute({
      customerName: 'Ivan',
      serviceDescription: 'Apartment cleaning',
      serviceAddress: 'Nevsky 25',
      customerPhone: null,
      quotedPrice: { amountMinor: 400000, currencyCode: 'RUB' },
      notes: 'Call on arrival',
      startAt: '2026-10-30T07:00:00Z',
      endAt: '2026-10-30T09:00:00Z',
    });

    expect(created).toMatchObject({
      id: 'development-manual-order-1',
      customerName: 'Ivan',
      serviceDescription: 'Apartment cleaning',
      serviceAddress: 'Nevsky 25',
      calendarEntryId: 'development-calendar-entry-1',
      quotedPrice: { amountMinor: 400000, currencyCode: 'RUB' },
    });
    expect(created).not.toHaveProperty('startAt');
    expect(created).not.toHaveProperty('endAt');
    await expect(calendarService.getEntry(created.calendarEntryId)).resolves.toMatchObject({
      type: 'external_order',
      title: 'Apartment cleaning',
      startAt: '2026-10-30T07:00:00Z',
      endAt: '2026-10-30T09:00:00Z',
    });
    await expect(calendarService.deleteEntry(created.calendarEntryId))
      .rejects.toEqual({ code: 'CalendarConflict' });
    await expect(calendarService.getEntry(created.calendarEntryId)).resolves.toMatchObject({
      id: created.calendarEntryId,
      type: 'external_order',
    });
    await expect(manualOrderService.getOrders()).resolves.toEqual([created]);
    await expect(manualOrderService.get(created.id)).resolves.toEqual(created);
    await expect(manualOrderService.get('missing')).rejects.toEqual({ code: 'OrderNotFound' });
  });
});
