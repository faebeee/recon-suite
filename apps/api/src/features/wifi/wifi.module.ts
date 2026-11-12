import { Module } from '@nestjs/common';
import { WifiController } from './wifi.controller.js';
import { WifiService } from './wifi.service.js';

@Module({ controllers: [WifiController], providers: [WifiService] })
export class WifiModule {}
