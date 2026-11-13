import {
  StandardSchemaValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './config/env.js';

/** Shared bootstrap for main.ts and e2e tests. */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  const origins = config
    .get('CORS_ORIGIN', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // Cookies carry the login session, so cross-origin calls need credentials ...
  app.enableCors({ origin: origins, credentials: true });
  // ... and state-changing requests from other origins are refused (login CSRF etc.).
  app.enableCsrfProtection({ trustedOrigins: origins });
  app.enableShutdownHooks();
  return app;
}
