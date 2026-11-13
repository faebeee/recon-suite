import { Module } from '@nestjs/common';
import { EmailSecurityController } from './email-security.controller.js';
import { EmailSecurityService } from './email-security.service.js';

@Module({
  controllers: [EmailSecurityController],
  providers: [EmailSecurityService],
})
export class EmailSecurityModule {}
