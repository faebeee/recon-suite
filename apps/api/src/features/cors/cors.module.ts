import { Module } from '@nestjs/common';
import { CorsController } from './cors.controller.js';
import { CorsService } from './cors.service.js';

@Module({
  controllers: [CorsController],
  providers: [CorsService],
})
export class CorsModule {}
