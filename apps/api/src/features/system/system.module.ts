import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { HealthController } from './health.controller.js';

/** Health check and tool catalog. */
@Module({ controllers: [HealthController, CatalogController] })
export class SystemModule {}
