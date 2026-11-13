import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.js';
import { AuthModule } from './core/auth/auth.module.js';
import { CoreModule } from './core/core.module.js';
import { DatabaseModule } from './core/db/database.module.js';
import { FEATURE_MODULES } from './features/index.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // No global rate limit. Only the login route applies ThrottlerGuard (password guessing).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    CoreModule,
    DatabaseModule,
    AuthModule,
    ...FEATURE_MODULES,
  ],
})
export class AppModule {}
