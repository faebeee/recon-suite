import { Controller, Get } from '@nestjs/common';
import type { HostStats, RuntimeInfo, SystemOverview } from '@recon/shared';
import { HostStatsService } from './host-stats.service.js';
import { PlatformDiagnosticsService } from './platform-diagnostics.service.js';
import { SystemOverviewService } from './system-overview.service.js';

/**
 * GET /api/system/runtime: where each tool runs (API host or API container),
 * which engine does the work and whether it is available.
 */
@Controller('system')
export class RuntimeController {
  constructor(
    private readonly diagnostics: PlatformDiagnosticsService,
    private readonly overviewService: SystemOverviewService,
    private readonly hostStats: HostStatsService,
  ) {}

  @Get('runtime')
  runtime(): RuntimeInfo {
    return this.diagnostics.runtime;
  }

  @Get('overview')
  overview(): Promise<SystemOverview> {
    return this.overviewService.overview();
  }

  @Get('host')
  host(): Promise<HostStats> {
    return this.hostStats.stats();
  }
}
