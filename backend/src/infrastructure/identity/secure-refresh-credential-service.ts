import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  RefreshCredentialService,
  type GeneratedRefreshCredential,
} from '../../application/identity/ports/credential-services.js';

@Injectable()
export class SecureRefreshCredentialService extends RefreshCredentialService {
  create(sessionId: string): GeneratedRefreshCredential {
    const value = `${sessionId}.${randomBytes(32).toString('base64url')}`;
    return { value, hash: this.hash(value) };
  }

  hash(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  hasSessionId(value: string, sessionId: string): boolean {
    return (
      value.startsWith(`${sessionId}.`) && value.length > sessionId.length + 1
    );
  }
}
