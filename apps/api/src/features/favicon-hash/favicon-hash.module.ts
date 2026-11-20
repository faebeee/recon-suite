import { Module } from '@nestjs/common';
import { FaviconHashController } from './favicon-hash.controller.js';
import { FaviconHashService } from './favicon-hash.service.js';

@Module({
  controllers: [FaviconHashController],
  providers: [FaviconHashService],
})
export class FaviconHashModule {}
