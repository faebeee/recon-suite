import { Module } from '@nestjs/common';
import { CookieAuditController } from './cookie-audit.controller.js';
import { CookieAuditService } from './cookie-audit.service.js';

@Module({
  controllers: [CookieAuditController],
  providers: [CookieAuditService],
})
export class CookieAuditModule {}
