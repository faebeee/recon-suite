import { Module } from '@nestjs/common';
import { DnssecController } from './dnssec.controller.js';
import { DnssecService } from './dnssec.service.js';

@Module({
  controllers: [DnssecController],
  providers: [DnssecService],
})
export class DnssecModule {}
