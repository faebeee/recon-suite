import { Module } from '@nestjs/common';
import { TlsController } from './tls.controller.js';
import { TlsService } from './tls.service.js';

@Module({ controllers: [TlsController], providers: [TlsService] })
export class TlsModule {}
