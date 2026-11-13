import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { HealthController } from './health.controller.js';
import { PlatformDiagnosticsService } from './platform-diagnostics.service.js';
import { RuntimeController } from './runtime.controller.js';

/** Health check, tool catalog, boot-time platform diagnosis and the runtime map. */
@Module({
  controllers: [HealthController, CatalogController, RuntimeController],
  providers: [PlatformDiagnosticsService],
})
export class SystemModule {}
