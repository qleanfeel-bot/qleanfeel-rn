import { Injectable } from '@nestjs/common';
import { Clock } from '../../application/identity/ports/credential-services.js';

@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}
