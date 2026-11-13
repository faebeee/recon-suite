import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  emailSecurityInputSchema,
  type EmailSecurityOutput,
  type EmailSecurityParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { EmailSecurityService } from './email-security.service.js';

@Controller('tools/email-security')
export class EmailSecurityController {
  constructor(private readonly service: EmailSecurityService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: emailSecurityInputSchema }) input: EmailSecurityParams,
  ): Promise<ToolResult<EmailSecurityOutput>> {
    return runTool(
      'email-security',
      input.target,
      () => this.service.check(input),
      { findings: (d) => d.report.findings },
    );
  }
}
