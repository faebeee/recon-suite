import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  tlsAuditInputSchema,
  type TlsAuditOutput,
  type TlsAuditParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { TlsAuditService } from './tls-audit.service.js';

@Controller('tools/tls-audit')
export class TlsAuditController {
  constructor(private readonly service: TlsAuditService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: tlsAuditInputSchema }) input: TlsAuditParams,
  ): Promise<ToolResult<TlsAuditOutput>> {
    return runTool('tls-audit', input.target, () => this.service.audit(input), {
      findings: (d) => d.report.findings,
    });
  }
}
