import { Module } from '@nestjs/common';
import { IpIntelController } from './ip-intel.controller.js';
import { IpIntelService } from './ip-intel.service.js';

@Module({
  controllers: [IpIntelController],
  providers: [IpIntelService],
})
export class IpIntelModule {}
