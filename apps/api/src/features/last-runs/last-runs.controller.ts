import { Controller, Get, Param } from '@nestjs/common';
import {
  lastRunToolSchema,
  type LastToolRunResponse,
  type ToolId,
} from '@recon/shared';
import { LastRunsRepository } from './last-runs.repository.js';

/** GET /api/last-runs/<tool>: the tool's most recent run (or `run: null`). */
@Controller('last-runs')
export class LastRunsController {
  constructor(private readonly repo: LastRunsRepository) {}

  @Get(':tool')
  async get(
    @Param('tool', { schema: lastRunToolSchema }) tool: ToolId,
  ): Promise<LastToolRunResponse> {
    return { run: await this.repo.get(tool) };
  }
}
