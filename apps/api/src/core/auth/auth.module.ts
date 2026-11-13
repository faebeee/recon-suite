import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticationModule } from '@nestjs/authentication';
import type { Env } from '../../config/env.js';
import './admin-user.js';
import { AuthController } from './auth.controller.js';
import { ApiTokenAuth, LocalOpenAuth, SessionAuth } from './auth.providers.js';
import { AuthSettings } from './auth-settings.service.js';
import { SqliteSessionStore } from './session.store.js';

/**
 * Single-operator authentication. The module's global guard protects every route;
 * mark exceptions with `@Public()` (health, catalog, auth status/login).
 */
@Global()
@Module({
  imports: [
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        session: {
          absoluteTtl: '7d',
          idleTtl: '12h',
          cookie: { secure: config.get('COOKIE_SECURE', { infer: true }) },
          trustedOrigins: corsOrigins(config),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthSettings,
    SqliteSessionStore,
    SessionAuth,
    ApiTokenAuth,
    LocalOpenAuth,
  ],
  exports: [AuthSettings],
})
export class AuthModule {}

export function corsOrigins(config: ConfigService<Env, true>): string[] {
  return config
    .get('CORS_ORIGIN', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
