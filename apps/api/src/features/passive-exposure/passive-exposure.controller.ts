import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  passiveExposureInputSchema,
  type PassiveExposureOutput,
  type PassiveExposureParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { PassiveExposureService } from './passive-exposure.service.js';

@Controller('tools/passive-exposure')
export class PassiveExposureController {
  constructor(private readonly service: PassiveExposureService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: passiveExposureInputSchema }) input: PassiveExposureParams,
  ): Promise<ToolResult<PassiveExposureOutput>> {
    return runTool(
      'passive-exposure',
      input.target,
      () => this.service.lookup(input),
      { findings: (d) => d.findings },
    );
  }
}
