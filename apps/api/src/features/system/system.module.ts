import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { HealthController } from './health.controller.js';
import { PlatformDiagnosticsService } from './platform-diagnostics.service.js';

/** Health check, tool catalog and the boot-time platform diagnosis. */
@Module({
  controllers: [HealthController, CatalogController],
  providers: [PlatformDiagnosticsService],
})
export class SystemModule {}
