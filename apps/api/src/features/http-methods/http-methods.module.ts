import { Module } from '@nestjs/common';
import { HttpMethodsController } from './http-methods.controller.js';
import { HttpMethodsService } from './http-methods.service.js';

@Module({
  controllers: [HttpMethodsController],
  providers: [HttpMethodsService],
})
export class HttpMethodsModule {}
