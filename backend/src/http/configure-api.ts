import { RequestMethod, type INestApplication } from '@nestjs/common';

export function configureApi(application: INestApplication): void {
  application.setGlobalPrefix('v1', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
}
