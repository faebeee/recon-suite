import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  exposedFilesInputSchema,
  type ExposedFilesOutput,
  type ExposedFilesParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { ExposedFilesService } from './exposed-files.service.js';

@Controller('tools/exposed-files')
export class ExposedFilesController {
  constructor(private readonly service: ExposedFilesService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: exposedFilesInputSchema }) input: ExposedFilesParams,
  ): Promise<ToolResult<ExposedFilesOutput>> {
    return runTool(
      'exposed-files',
      input.target,
      () => this.service.check(input),
      { findings: (d) => d.findings },
    );
  }
}
