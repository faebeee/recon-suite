import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  corsInputSchema,
  type CorsOutput,
  type CorsParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { CorsService } from './cors.service.js';

@Controller('tools/cors')
export class CorsController {
  constructor(private readonly service: CorsService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: corsInputSchema }) input: CorsParams,
  ): Promise<ToolResult<CorsOutput>> {
    return runTool('cors', input.target, () => this.service.check(input), {
      findings: (d) => d.findings,
    });
  }
}
