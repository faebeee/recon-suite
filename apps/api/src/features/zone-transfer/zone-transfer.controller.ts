import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  zoneTransferInputSchema,
  type ToolResult,
  type ZoneTransferOutput,
  type ZoneTransferParams,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { ZoneTransferService } from './zone-transfer.service.js';

@Controller('tools/zone-transfer')
export class ZoneTransferController {
  constructor(private readonly service: ZoneTransferService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: zoneTransferInputSchema }) input: ZoneTransferParams,
  ): Promise<ToolResult<ZoneTransferOutput>> {
    return runTool(
      'zone-transfer',
      input.target,
      () => this.service.transfer(input),
      {
        findings: (d) => d.findings,
      },
    );
  }
}
