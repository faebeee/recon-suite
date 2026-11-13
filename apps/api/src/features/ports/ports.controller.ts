import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  portsInputSchema,
  type PortsOutput,
  type PortsParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { portsFindings } from './ports.findings.js';
import { PortsService } from './ports.service.js';

@Controller('tools/ports')
export class PortsController {
  constructor(private readonly ports: PortsService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: portsInputSchema }) input: PortsParams,
  ): Promise<ToolResult<PortsOutput>> {
    return runTool('ports', input.target, () => this.ports.scan(input), {
      findings: portsFindings,
    });
  }
}
