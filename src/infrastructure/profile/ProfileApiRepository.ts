import type { Profile } from '../../domain/profile/entities/Profile';
import type { ProfileRepository } from '../../domain/profile/repositories/ProfileRepository';
import { HttpError } from '../http/HttpError';
import { ProfileApi } from './ProfileApi';
import { profileFromResponse } from './profileMappers';

/** Adapts the current-user API to the provider-independent repository contract. */
export class ProfileApiRepository implements ProfileRepository {
  public constructor(private readonly api: ProfileApi) {}

  public async getProfile(userId: string): Promise<Profile | null> {
    try {
      return this.assertRequestedIdentity(profileFromResponse(await this.api.getCurrentProfile()), userId);
    } catch (error) {
      if (error instanceof HttpError && error.code === 'NotFound') {
        return null;
      }
      throw toRepositoryError(error);
    }
  }

  public async updateDisplayName(userId: string, displayName: string): Promise<Profile | null> {
    try {
      return this.assertRequestedIdentity(
        profileFromResponse(await this.api.updateCurrentProfile({ displayName })),
        userId,
      );
    } catch (error) {
      if (error instanceof HttpError && error.code === 'NotFound') {
        return null;
      }
      throw toRepositoryError(error);
    }
  }

  private assertRequestedIdentity(profile: Profile, userId: string): Profile {
    if (profile.userId !== userId) {
      throw { code: 'UnexpectedResponse' };
    }
    return profile;
  }
}

function toRepositoryError(error: unknown): { readonly code: string } {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { readonly code: unknown }).code;
    switch (code) {
      case 'BadRequest':
        return { code: 'ValidationError' };
      case 'Unauthorized':
        return { code: 'Unauthorized' };
      case 'Forbidden':
        return { code: 'Forbidden' };
      case 'ServerError':
        return { code: 'ServerError' };
      case 'NetworkError':
        return { code: 'NetworkError' };
      case 'UnexpectedResponse':
        return { code: 'UnexpectedResponse' };
    }
  }
  return { code: 'UnexpectedResponse' };
}
