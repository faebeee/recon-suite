import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  techFingerprintInputSchema,
  type TechFingerprintOutput,
  type TechFingerprintParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { TechFingerprintService } from './tech-fingerprint.service.js';

@Controller('tools/tech-fingerprint')
export class TechFingerprintController {
  constructor(private readonly service: TechFingerprintService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: techFingerprintInputSchema }) input: TechFingerprintParams,
  ): Promise<ToolResult<TechFingerprintOutput>> {
    return runTool('tech-fingerprint', input.target, () =>
      this.service.fingerprint(input),
    );
  }
}
