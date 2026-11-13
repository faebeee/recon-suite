import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ipIntelInputSchema,
  type IpIntelOutput,
  type IpIntelParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { IpIntelService } from './ip-intel.service.js';

@Controller('tools/ip-intel')
export class IpIntelController {
  constructor(private readonly service: IpIntelService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: ipIntelInputSchema }) input: IpIntelParams,
  ): Promise<ToolResult<IpIntelOutput>> {
    return runTool('ip-intel', input.target, () => this.service.lookup(input));
  }
}
