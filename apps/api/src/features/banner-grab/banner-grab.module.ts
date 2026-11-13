import { Module } from '@nestjs/common';
import { BannerGrabController } from './banner-grab.controller.js';
import { BannerGrabService } from './banner-grab.service.js';

@Module({ controllers: [BannerGrabController], providers: [BannerGrabService] })
export class BannerGrabModule {}
