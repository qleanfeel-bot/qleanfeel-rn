import type { Profile } from '../../domain/profile/entities/Profile';
import type { ProfileRepository } from '../../domain/profile/repositories/ProfileRepository';

/** Application operations for reading a profile and updating its display name. */
export class ProfileService {
  public constructor(private readonly profiles: ProfileRepository) {}

  public getProfile(userId: string): Promise<Profile | null> {
    return this.profiles.getProfile(userId);
  }

  public updateDisplayName(userId: string, displayName: string): Promise<Profile | null> {
    return this.profiles.updateDisplayName(userId, displayName);
  }
}
