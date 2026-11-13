import { Module } from '@nestjs/common';
import { ReverseIpController } from './reverse-ip.controller.js';
import { ReverseIpService } from './reverse-ip.service.js';

@Module({ controllers: [ReverseIpController], providers: [ReverseIpService] })
export class ReverseIpModule {}
