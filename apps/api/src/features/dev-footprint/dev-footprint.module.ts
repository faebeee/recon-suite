import { Module } from '@nestjs/common';
import { DevFootprintController } from './dev-footprint.controller.js';
import { DevFootprintService } from './dev-footprint.service.js';

@Module({
  controllers: [DevFootprintController],
  providers: [DevFootprintService],
})
export class DevFootprintModule {}
