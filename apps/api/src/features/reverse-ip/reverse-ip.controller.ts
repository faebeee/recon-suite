import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  reverseIpInputSchema,
  type ReverseIpOutput,
  type ReverseIpParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { ReverseIpService } from './reverse-ip.service.js';

@Controller('tools/reverse-ip')
export class ReverseIpController {
  constructor(private readonly service: ReverseIpService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: reverseIpInputSchema }) input: ReverseIpParams,
  ): Promise<ToolResult<ReverseIpOutput>> {
    return runTool('reverse-ip', input.target, () =>
      this.service.lookup(input),
    );
  }
}
