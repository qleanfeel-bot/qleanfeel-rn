import type { HttpFetch, HttpResponse } from '../../infrastructure/http/HttpTransport';
import type { ProfileResponseDto } from '../../infrastructure/profile/ProfileApi';

const DEVELOPMENT_USER_ID = 'development-preview-user';

/** In-memory API endpoint used by the normal HTTP/API/repository chain in development. */
export function createDevelopmentProfileHttpFetch(): HttpFetch {
  let profile: ProfileResponseDto['profile'] = {
    userId: DEVELOPMENT_USER_ID,
    displayName: 'Qleanfeel User',
    phone: null,
    email: null,
    avatar: null,
    locale: null,
    country: null,
  };

  return async (url, init) => {
    if (!url.endsWith('/v1/me/profile')) {
      return response(404, { error: { code: 'PROFILE_NOT_FOUND' } });
    }
    if (init.headers.Authorization !== 'Bearer development-api-access-token') {
      return response(401, { error: { code: 'UNAUTHORIZED' } });
    }
    if (init.method === 'GET') {
      return response(200, { profile });
    }
    let body: unknown;
    try {
      body = JSON.parse(init.body ?? '');
    } catch {
      return response(400, { error: { code: 'VALIDATION_ERROR' } });
    }
    if (
      typeof body !== 'object' ||
      body === null ||
      !('displayName' in body) ||
      typeof body.displayName !== 'string' ||
      body.displayName.trim().length === 0 ||
      body.displayName.length > 80 ||
      Object.keys(body).some(key => key !== 'displayName')
    ) {
      return response(400, { error: { code: 'VALIDATION_ERROR' } });
    }
    profile = { ...profile, displayName: body.displayName.trim() };
    return response(200, { profile });
  };
}

function response(status: number, body: unknown): HttpResponse {
  return { status, json: async () => body };
}
