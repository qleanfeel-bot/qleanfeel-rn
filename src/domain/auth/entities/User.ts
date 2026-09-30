export type UserId = string;

export const USER_STATUSES = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];

export interface User {
  readonly id: UserId;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
