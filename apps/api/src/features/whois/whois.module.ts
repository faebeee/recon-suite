import { Module } from '@nestjs/common';
import { WhoisController } from './whois.controller.js';
import { WhoisService } from './whois.service.js';

@Module({ controllers: [WhoisController], providers: [WhoisService] })
export class WhoisModule {}
