import { Module } from '@nestjs/common';
import { CloudStorageController } from './cloud-storage.controller.js';
import { CloudStorageService } from './cloud-storage.service.js';

@Module({
  controllers: [CloudStorageController],
  providers: [CloudStorageService],
})
export class CloudStorageModule {}
