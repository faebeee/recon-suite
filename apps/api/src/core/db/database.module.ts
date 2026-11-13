import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleModule } from '@nestjs/drizzle';
import type { Env } from '../../config/env.js';
import { openDatabase } from './database.js';

/**
 * SQLite via Node's built-in node:sqlite and Drizzle. Inject with `@InjectDrizzle()` and
 * type it as `Db` (core/db/database.ts). Migrations run at startup: the API is a single
 * process, so there is no race between instances.
 */
@Global()
@Module({
  imports: [
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        db: openDatabase(config.get('DATABASE_PATH', { infer: true })),
      }),
    }),
  ],
})
export class DatabaseModule {}
