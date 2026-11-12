import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  tlsInputSchema,
  type TlsOutput,
  type TlsParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { TlsService } from './tls.service.js';

@Controller('tools/tls')
export class TlsController {
  constructor(private readonly tls: TlsService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: tlsInputSchema }) input: TlsParams,
  ): Promise<ToolResult<TlsOutput>> {
    return runTool('tls', `${input.target}:${input.port}`, () =>
      this.tls.inspect(input),
    );
  }
}
