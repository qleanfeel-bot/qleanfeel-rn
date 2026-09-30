import type { Profile } from '../entities/Profile';

describe('Profile', () => {
  it('represents a user-linked profile with optional contact and locale data', () => {
    const profile: Profile = {
      userId: 'qleanfeel-user-1',
      displayName: 'Alex',
      phone: null,
      email: null,
      avatar: null,
      locale: null,
      country: null,
    };

    expect(profile).toEqual({
      userId: 'qleanfeel-user-1',
      displayName: 'Alex',
      phone: null,
      email: null,
      avatar: null,
      locale: null,
      country: null,
    });
  });
});
