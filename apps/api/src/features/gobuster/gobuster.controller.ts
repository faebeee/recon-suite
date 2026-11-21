import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  gobusterInputSchema,
  type GobusterOutput,
  type GobusterParams,
  type GobusterWordlistsOutput,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { GobusterService } from './gobuster.service.js';

@Controller('tools/gobuster')
export class GobusterController {
  constructor(private readonly service: GobusterService) {}

  /** Helper endpoint for the wordlist dropdown (plain response, no ToolResult envelope). */
  @Get('wordlists')
  wordlists(): GobusterWordlistsOutput {
    return this.service.listWordlists();
  }

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: gobusterInputSchema }) input: GobusterParams,
  ): Promise<ToolResult<GobusterOutput>> {
    return runTool('gobuster', input.target, () => this.service.scan(input), {
      findings: (d) => d.findings,
    });
  }
}
