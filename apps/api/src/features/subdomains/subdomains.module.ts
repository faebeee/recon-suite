import { Module } from '@nestjs/common';
import { SubdomainsController } from './subdomains.controller.js';
import { SubdomainsService } from './subdomains.service.js';

@Module({ controllers: [SubdomainsController], providers: [SubdomainsService] })
export class SubdomainsModule {}
