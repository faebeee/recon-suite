import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  httpHeadersInputSchema,
  type HttpHeadersOutput,
  type HttpHeadersParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { httpHeadersFindings } from './http-headers.findings.js';
import { HttpHeadersService } from './http-headers.service.js';

@Controller('tools/http-headers')
export class HttpHeadersController {
  constructor(private readonly httpHeaders: HttpHeadersService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: httpHeadersInputSchema }) input: HttpHeadersParams,
  ): Promise<ToolResult<HttpHeadersOutput>> {
    return runTool(
      'http-headers',
      input.target,
      () => this.httpHeaders.inspect(input),
      { findings: httpHeadersFindings },
    );
  }
}
