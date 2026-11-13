import { Module } from '@nestjs/common';
import { NetworkScanController } from './network-scan.controller.js';
import { NetworkScanService } from './network-scan.service.js';

@Module({
  controllers: [NetworkScanController],
  providers: [NetworkScanService],
})
export class NetworkScanModule {}
