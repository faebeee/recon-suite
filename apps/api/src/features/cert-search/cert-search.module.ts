import { Module } from '@nestjs/common';
import { CertSearchController } from './cert-search.controller.js';
import { CertSearchService } from './cert-search.service.js';

@Module({ controllers: [CertSearchController], providers: [CertSearchService] })
export class CertSearchModule {}
