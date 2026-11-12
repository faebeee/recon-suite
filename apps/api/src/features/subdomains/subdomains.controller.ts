import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  subdomainsInputSchema,
  type SubdomainsOutput,
  type SubdomainsParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { SubdomainsService } from './subdomains.service.js';

@Controller('tools/subdomains')
export class SubdomainsController {
  constructor(private readonly subdomains: SubdomainsService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: subdomainsInputSchema }) input: SubdomainsParams,
  ): Promise<ToolResult<SubdomainsOutput>> {
    return runTool('subdomains', input.target, () =>
      this.subdomains.search(input),
    );
  }
}
