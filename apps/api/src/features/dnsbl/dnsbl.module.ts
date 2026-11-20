import { Module } from '@nestjs/common';
import { DnsblController } from './dnsbl.controller.js';
import { DnsblService } from './dnsbl.service.js';

@Module({
  controllers: [DnsblController],
  providers: [DnsblService],
})
export class DnsblModule {}
