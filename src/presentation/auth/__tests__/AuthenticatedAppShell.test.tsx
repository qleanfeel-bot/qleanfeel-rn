import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { CalendarService } from '../../../application/calendar/CalendarService';
import { CreateScheduledManualOrder } from '../../../application/manualOrder/CreateScheduledManualOrder';
import { ManualOrderService } from '../../../application/manualOrder/ManualOrderService';
import { ProfileService } from '../../../application/profile/ProfileService';
import type { CalendarRepository } from '../../../domain/calendar/repositories/CalendarRepository';
import type { ManualOrderRepository } from '../../../domain/manualOrder/repositories/ManualOrderRepository';
import type { Profile } from '../../../domain/profile/entities/Profile';
import type { ProfileRepository } from '../../../domain/profile/repositories/ProfileRepository';
import { CalendarScreen } from '../../calendar/CalendarScreen';
import { ProfileScreen } from '../../profile/ProfileScreen';
import { AuthenticatedAppShell } from '../AuthenticatedAppShell';

const profile: Profile = {
  userId: 'user-1',
  displayName: 'Qleanfeel User',
  phone: null,
  email: null,
  avatar: null,
  locale: null,
  country: null,
};

function createProfileService(): ProfileService {
  const repository: ProfileRepository = {
    getProfile: jest.fn().mockResolvedValue(profile),
    updateDisplayName: jest.fn().mockResolvedValue(profile),
  };
  return new ProfileService(repository);
}

function createCalendarService(): CalendarService {
  const repository: CalendarRepository = {
    getEntries: jest.fn().mockResolvedValue([]),
    getEntry: jest.fn(async () => {
      throw new Error('not used in shell tests');
    }),
    createEntry: jest.fn(async () => {
      throw new Error('not used in shell tests');
    }),
    updateEntry: jest.fn(async () => {
      throw new Error('not used in shell tests');
    }),
    deleteEntry: jest.fn().mockResolvedValue(undefined),
  };
  return new CalendarService(repository);
}

function createManualOrderService(): ManualOrderService {
  const repository: ManualOrderRepository = {
    getOrders: jest.fn().mockResolvedValue([]),
    createOrder: jest.fn(async () => {
      throw new Error('not used in shell tests');
    }),
    getOrder: jest.fn(async () => {
      throw new Error('not used in shell tests');
    }),
  };
  return new ManualOrderService(repository);
}

async function renderShell(
  profileService = createProfileService(),
  calendarService = createCalendarService(),
  manualOrderService = createManualOrderService(),
  onLogout = jest.fn(),
) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <AuthenticatedAppShell
        accountStatus="active"
        calendarService={calendarService}
        createScheduledManualOrder={new CreateScheduledManualOrder(calendarService, manualOrderService)}
        manualOrderService={manualOrderService}
        onLogout={onLogout}
        profileService={profileService}
        userId="user-1"
      />,
    );
  });
  return { renderer, profileService, calendarService, manualOrderService, onLogout };
}

async function press(renderer: ReactTestRenderer.ReactTestRenderer, testID: string) {
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ testID }).props.onPress();
  });
}

describe('AuthenticatedAppShell', () => {
  it('starts on Profile and passes its existing dependencies through', async () => {
    const { renderer, profileService } = await renderShell();

    expect(renderer.root.findByProps({ testID: 'authenticated-app-shell' })).toBeTruthy();
    expect(renderer.root.findByType(ProfileScreen).props.profileService).toBe(profileService);
    expect(renderer.root.findByProps({ testID: 'authenticated-shell-profile-button' })
      .props.accessibilityState).toEqual({ selected: true });
    expect(renderer.root.findAllByType(CalendarScreen)).toHaveLength(0);
  });

  it('switches to Calendar and passes the supplied CalendarService unchanged', async () => {
    const { renderer, calendarService } = await renderShell();

    await press(renderer, 'authenticated-shell-calendar-button');

    expect(renderer.root.findByType(CalendarScreen).props.calendarService).toBe(calendarService);
    expect(renderer.root.findAllByType(ProfileScreen)).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'authenticated-shell-calendar-button' })
      .props.accessibilityState).toEqual({ selected: true });
  });

  it('switches to Orders using the supplied ManualOrder dependencies', async () => {
    const { renderer } = await renderShell();

    await press(renderer, 'authenticated-shell-orders-button');

    expect(renderer.root.findByProps({ testID: 'manual-orders-screen' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'authenticated-shell-orders-button' })
      .props.accessibilityState).toEqual({ selected: true });
  });

  it('returns to Profile and keeps the existing logout callback reachable', async () => {
    const { renderer, onLogout } = await renderShell();

    await press(renderer, 'authenticated-shell-calendar-button');
    await press(renderer, 'authenticated-shell-profile-button');
    expect(renderer.root.findByType(ProfileScreen)).toBeTruthy();

    await press(renderer, 'logout-button');

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
