import { Module } from '@nestjs/common';
import { ApiDiscoveryController } from './api-discovery.controller.js';
import { ApiDiscoveryService } from './api-discovery.service.js';

@Module({
  controllers: [ApiDiscoveryController],
  providers: [ApiDiscoveryService],
})
export class ApiDiscoveryModule {}
