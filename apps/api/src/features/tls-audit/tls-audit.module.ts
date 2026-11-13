import { Module } from '@nestjs/common';
import { TlsAuditController } from './tls-audit.controller.js';
import { TlsAuditService } from './tls-audit.service.js';

@Module({
  controllers: [TlsAuditController],
  providers: [TlsAuditService],
})
export class TlsAuditModule {}
