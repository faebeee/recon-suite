import { Controller, Get } from '@nestjs/common';
import type { RuntimeInfo } from '@recon/shared';
import { PlatformDiagnosticsService } from './platform-diagnostics.service.js';

/**
 * GET /api/system/runtime: where each tool runs (API host, API container, Kali container),
 * which engine does the work and whether it is available. Not @Public(): it describes the
 * server (platform, container names).
 */
@Controller('system')
export class RuntimeController {
  constructor(private readonly diagnostics: PlatformDiagnosticsService) {}

  @Get('runtime')
  runtime(): RuntimeInfo {
    return this.diagnostics.runtime;
  }
}
