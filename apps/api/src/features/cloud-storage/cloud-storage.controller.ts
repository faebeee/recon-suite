import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  cloudStorageInputSchema,
  type CloudStorageOutput,
  type CloudStorageParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { CloudStorageService } from './cloud-storage.service.js';

@Controller('tools/cloud-storage')
export class CloudStorageController {
  constructor(private readonly service: CloudStorageService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: cloudStorageInputSchema }) input: CloudStorageParams,
  ): Promise<ToolResult<CloudStorageOutput>> {
    return runTool(
      'cloud-storage',
      input.target,
      () => this.service.scan(input),
      {
        findings: (d) => d.findings,
      },
    );
  }
}
