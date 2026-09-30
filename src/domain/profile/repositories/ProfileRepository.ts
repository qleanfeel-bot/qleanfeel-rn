import type { Profile } from '../entities/Profile';

/** Provider-independent access to profile data. */
export interface ProfileRepository {
  /** Returns null when this user does not yet have a profile. */
  getProfile(userId: string): Promise<Profile | null>;

  /** Returns null when this user does not yet have a profile. */
  updateDisplayName(userId: string, displayName: string): Promise<Profile | null>;
}
