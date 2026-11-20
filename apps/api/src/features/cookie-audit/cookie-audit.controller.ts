import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  cookieAuditInputSchema,
  type CookieAuditOutput,
  type CookieAuditParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { CookieAuditService } from './cookie-audit.service.js';

@Controller('tools/cookie-audit')
export class CookieAuditController {
  constructor(private readonly service: CookieAuditService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: cookieAuditInputSchema }) input: CookieAuditParams,
  ): Promise<ToolResult<CookieAuditOutput>> {
    return runTool(
      'cookie-audit',
      input.target,
      () => this.service.audit(input),
      { findings: (d) => d.findings },
    );
  }
}
