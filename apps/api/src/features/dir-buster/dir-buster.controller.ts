import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  dirBusterInputSchema,
  type DirBusterOutput,
  type DirBusterParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { DirBusterService } from './dir-buster.service.js';

@Controller('tools/dir-buster')
export class DirBusterController {
  constructor(private readonly service: DirBusterService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: dirBusterInputSchema }) input: DirBusterParams,
  ): Promise<ToolResult<DirBusterOutput>> {
    return runTool('dir-buster', input.target, () => this.service.scan(input), {
      findings: (d) => d.findings,
    });
  }
}
