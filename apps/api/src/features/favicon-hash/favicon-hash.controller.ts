import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  faviconHashInputSchema,
  type FaviconHashOutput,
  type FaviconHashParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { FaviconHashService } from './favicon-hash.service.js';

@Controller('tools/favicon-hash')
export class FaviconHashController {
  constructor(private readonly service: FaviconHashService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: faviconHashInputSchema }) input: FaviconHashParams,
  ): Promise<ToolResult<FaviconHashOutput>> {
    return runTool('favicon-hash', input.target, () =>
      this.service.hash(input),
    );
  }
}
