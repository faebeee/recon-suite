import { Module } from '@nestjs/common';
import { ZoneTransferController } from './zone-transfer.controller.js';
import { ZoneTransferService } from './zone-transfer.service.js';

@Module({
  controllers: [ZoneTransferController],
  providers: [ZoneTransferService],
})
export class ZoneTransferModule {}
