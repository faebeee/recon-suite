import { Module } from '@nestjs/common';
import { HostScanController } from './host-scan.controller.js';
import { HostScanService } from './host-scan.service.js';

@Module({ controllers: [HostScanController], providers: [HostScanService] })
export class HostScanModule {}
