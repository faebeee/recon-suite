import { Controller, Get, Param } from '@nestjs/common';
import {
  lastRunToolSchema,
  type LastRunsSummaryResponse,
  type LastToolRunResponse,
  type ToolId,
} from '@recon/shared';
import { LastRunsRepository } from './last-runs.repository.js';

/**
 * GET /api/last-runs: summary of every tool's last run (navigation markers).
 * GET /api/last-runs/<tool>: the tool's most recent run (or `run: null`).
 */
@Controller('last-runs')
export class LastRunsController {
  constructor(private readonly repo: LastRunsRepository) {}

  @Get()
  async list(): Promise<LastRunsSummaryResponse> {
    return { runs: await this.repo.summaries() };
  }

  @Get(':tool')
  async get(
    @Param('tool', { schema: lastRunToolSchema }) tool: ToolId,
  ): Promise<LastToolRunResponse> {
    return { run: await this.repo.get(tool) };
  }
}
