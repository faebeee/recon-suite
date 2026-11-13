import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  certSearchInputSchema,
  type CertSearchOutput,
  type CertSearchParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { CertSearchService } from './cert-search.service.js';

@Controller('tools/cert-search')
export class CertSearchController {
  constructor(private readonly service: CertSearchService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: certSearchInputSchema }) input: CertSearchParams,
  ): Promise<ToolResult<CertSearchOutput>> {
    return runTool('cert-search', input.target, () =>
      this.service.search(input),
    );
  }
}
