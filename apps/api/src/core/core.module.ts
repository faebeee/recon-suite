import { Global, Module } from '@nestjs/common';
import { HttpClientService } from './http/http-client.service.js';
import { TargetGuardService } from './net/target-guard.service.js';

/** Cross-cutting infrastructure available to every feature module. */
@Global()
@Module({
  providers: [TargetGuardService, HttpClientService],
  exports: [TargetGuardService, HttpClientService],
})
export class CoreModule {}
