import type { Profile } from '../../domain/profile/entities/Profile';
import type { ProfileResponseDto } from './ProfileApi';

export function profileFromResponse(response: ProfileResponseDto): Profile {
  const value = response.profile;
  if (
    typeof value?.userId !== 'string' ||
    typeof value.displayName !== 'string' ||
    !isNullableString(value.phone) ||
    !isNullableString(value.email) ||
    !isNullableString(value.avatar) ||
    !isNullableString(value.locale) ||
    !isNullableString(value.country)
  ) {
    throw { code: 'UnexpectedResponse' };
  }

  return {
    userId: value.userId,
    displayName: value.displayName,
    phone: value.phone,
    email: value.email,
    avatar: value.avatar,
    locale: value.locale,
    country: value.country,
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
