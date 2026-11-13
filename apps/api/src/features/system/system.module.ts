import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { HealthController } from './health.controller.js';
import { PlatformDiagnosticsService } from './platform-diagnostics.service.js';
import { HostStatsService } from './host-stats.service.js';
import { RuntimeController } from './runtime.controller.js';
import { SystemOverviewService } from './system-overview.service.js';

/** Health check, tool catalog, boot-time platform diagnosis, the runtime map and the system overview. */
@Module({
  controllers: [HealthController, CatalogController, RuntimeController],
  providers: [
    PlatformDiagnosticsService,
    SystemOverviewService,
    HostStatsService,
  ],
})
export class SystemModule {}
