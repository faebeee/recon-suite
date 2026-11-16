import { Module } from '@nestjs/common';
import { PassiveExposureController } from './passive-exposure.controller.js';
import { PassiveExposureService } from './passive-exposure.service.js';

@Module({
  controllers: [PassiveExposureController],
  providers: [PassiveExposureService],
})
export class PassiveExposureModule {}
