import { Module } from '@nestjs/common';
import { ExposedFilesController } from './exposed-files.controller.js';
import { ExposedFilesService } from './exposed-files.service.js';

@Module({
  controllers: [ExposedFilesController],
  providers: [ExposedFilesService],
})
export class ExposedFilesModule {}
