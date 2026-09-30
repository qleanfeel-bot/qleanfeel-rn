import { HttpTransport } from '../http/HttpTransport';

export interface ProfileResponseDto {
  readonly profile: {
    readonly userId: string;
    readonly displayName: string;
    readonly phone: string | null;
    readonly email: string | null;
    readonly avatar: string | null;
    readonly locale: string | null;
    readonly country: string | null;
  };
}

export interface UpdateProfileRequestDto {
  readonly displayName: string;
}

/** API contract for the authenticated current user's profile. */
export class ProfileApi {
  public constructor(private readonly transport: HttpTransport) {}

  public getCurrentProfile(): Promise<ProfileResponseDto> {
    return this.transport.request<ProfileResponseDto>({
      method: 'GET',
      path: '/v1/me/profile',
      authenticated: true,
    });
  }

  public updateCurrentProfile(body: UpdateProfileRequestDto): Promise<ProfileResponseDto> {
    return this.transport.request<ProfileResponseDto>({
      method: 'PATCH',
      path: '/v1/me/profile',
      body,
      authenticated: true,
    });
  }
}
