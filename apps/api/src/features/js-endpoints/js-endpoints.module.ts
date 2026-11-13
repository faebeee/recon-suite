import { Module } from '@nestjs/common';
import { JsEndpointsController } from './js-endpoints.controller.js';
import { JsEndpointsService } from './js-endpoints.service.js';

@Module({
  controllers: [JsEndpointsController],
  providers: [JsEndpointsService],
})
export class JsEndpointsModule {}
