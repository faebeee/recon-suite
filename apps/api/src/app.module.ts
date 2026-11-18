import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.js';
import { CoreModule } from './core/core.module.js';
import { DatabaseModule } from './core/db/database.module.js';
import { FEATURE_MODULES } from './features/index.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    CoreModule,
    DatabaseModule,
    ...FEATURE_MODULES,
  ],
})
export class AppModule {}
