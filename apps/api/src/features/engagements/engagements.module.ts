import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EngagementsController } from './engagements.controller.js';
import { EngagementsRepository } from './engagements.repository.js';
import { RunCaptureInterceptor } from './run-capture.interceptor.js';

/** Engagement workspace: scope, run history, findings, notes and export. */
@Module({
  controllers: [EngagementsController],
  providers: [
    EngagementsRepository,
    { provide: APP_INTERCEPTOR, useClass: RunCaptureInterceptor },
  ],
})
export class EngagementsModule {}
