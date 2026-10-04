export type UserStatus = 'active' | 'suspended';

export class User {
  constructor(
    readonly id: string,
    readonly status: UserStatus,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(id: string, now: Date): User {
    return new User(id, 'active', now, now);
  }

  get isActive(): boolean {
    return this.status === 'active';
  }
}
