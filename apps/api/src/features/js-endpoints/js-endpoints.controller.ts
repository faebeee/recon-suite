import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  jsEndpointsInputSchema,
  type JsEndpointsOutput,
  type JsEndpointsParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { JsEndpointsService } from './js-endpoints.service.js';

@Controller('tools/js-endpoints')
export class JsEndpointsController {
  constructor(private readonly service: JsEndpointsService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: jsEndpointsInputSchema }) input: JsEndpointsParams,
  ): Promise<ToolResult<JsEndpointsOutput>> {
    return runTool(
      'js-endpoints',
      input.target,
      () => this.service.analyse(input),
      { findings: (d) => d.findings },
    );
  }
}
