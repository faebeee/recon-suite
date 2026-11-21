import { Module } from '@nestjs/common';
import { DirBusterController } from './dir-buster.controller.js';
import { DirBusterService } from './dir-buster.service.js';

@Module({
  controllers: [DirBusterController],
  providers: [DirBusterService],
})
export class DirBusterModule {}
