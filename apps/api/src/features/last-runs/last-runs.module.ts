import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LastRunInterceptor } from './last-run.interceptor.js';
import { LastRunsController } from './last-runs.controller.js';
import { LastRunsRepository } from './last-runs.repository.js';

/** Persists the most recent run of every tool so tool pages can show it again. */
@Module({
  controllers: [LastRunsController],
  providers: [
    LastRunsRepository,
    { provide: APP_INTERCEPTOR, useClass: LastRunInterceptor },
  ],
})
export class LastRunsModule {}
