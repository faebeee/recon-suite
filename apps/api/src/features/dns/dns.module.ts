import { Module } from '@nestjs/common';
import { DnsController } from './dns.controller.js';
import { DnsService } from './dns.service.js';

@Module({ controllers: [DnsController], providers: [DnsService] })
export class DnsModule {}
