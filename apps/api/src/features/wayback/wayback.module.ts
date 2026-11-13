import { Module } from '@nestjs/common';
import { WaybackController } from './wayback.controller.js';
import { WaybackService } from './wayback.service.js';

@Module({
  controllers: [WaybackController],
  providers: [WaybackService],
})
export class WaybackModule {}
