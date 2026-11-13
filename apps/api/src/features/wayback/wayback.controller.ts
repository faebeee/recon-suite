import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  waybackInputSchema,
  type ToolResult,
  type WaybackOutput,
  type WaybackParams,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { WaybackService } from './wayback.service.js';

@Controller('tools/wayback')
export class WaybackController {
  constructor(private readonly service: WaybackService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: waybackInputSchema }) input: WaybackParams,
  ): Promise<ToolResult<WaybackOutput>> {
    return runTool('wayback', input.target, () => this.service.lookup(input));
  }
}
