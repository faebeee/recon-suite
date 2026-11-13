import { Module } from '@nestjs/common';
import { WebFilesController } from './web-files.controller.js';
import { WebFilesService } from './web-files.service.js';

@Module({
  controllers: [WebFilesController],
  providers: [WebFilesService],
})
export class WebFilesModule {}
