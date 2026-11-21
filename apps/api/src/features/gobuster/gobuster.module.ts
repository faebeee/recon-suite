import { Module } from '@nestjs/common';
import { GobusterController } from './gobuster.controller.js';
import { GobusterService } from './gobuster.service.js';

@Module({
  controllers: [GobusterController],
  providers: [GobusterService],
})
export class GobusterModule {}
