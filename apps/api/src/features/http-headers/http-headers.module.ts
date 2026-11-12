import { Module } from '@nestjs/common';
import { HttpHeadersController } from './http-headers.controller.js';
import { HttpHeadersService } from './http-headers.service.js';

@Module({
  controllers: [HttpHeadersController],
  providers: [HttpHeadersService],
})
export class HttpHeadersModule {}
