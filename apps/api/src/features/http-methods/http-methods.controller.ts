import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  httpMethodsInputSchema,
  type HttpMethodsOutput,
  type HttpMethodsParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { HttpMethodsService } from './http-methods.service.js';

@Controller('tools/http-methods')
export class HttpMethodsController {
  constructor(private readonly service: HttpMethodsService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: httpMethodsInputSchema }) input: HttpMethodsParams,
  ): Promise<ToolResult<HttpMethodsOutput>> {
    return runTool(
      'http-methods',
      input.target,
      () => this.service.check(input),
      { findings: (d) => d.findings },
    );
  }
}
