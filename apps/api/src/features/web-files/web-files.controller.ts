import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  webFilesInputSchema,
  type WebFilesOutput,
  type WebFilesParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { webFilesFindings } from './web-files.findings.js';
import { WebFilesService } from './web-files.service.js';

@Controller('tools/web-files')
export class WebFilesController {
  constructor(private readonly service: WebFilesService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: webFilesInputSchema }) input: WebFilesParams,
  ): Promise<ToolResult<WebFilesOutput>> {
    return runTool('web-files', input.target, () => this.service.fetch(input), {
      findings: webFilesFindings,
    });
  }
}
