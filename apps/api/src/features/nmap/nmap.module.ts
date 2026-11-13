import { Module } from '@nestjs/common';
import { NmapController } from './nmap.controller.js';
import { NmapService } from './nmap.service.js';

@Module({ controllers: [NmapController], providers: [NmapService] })
export class NmapModule {}
