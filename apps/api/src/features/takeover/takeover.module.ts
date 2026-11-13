import { Module } from '@nestjs/common';
import { TakeoverController } from './takeover.controller.js';
import { TakeoverService } from './takeover.service.js';

@Module({
  controllers: [TakeoverController],
  providers: [TakeoverService],
})
export class TakeoverModule {}
