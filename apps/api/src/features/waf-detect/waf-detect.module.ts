import { Module } from '@nestjs/common';
import { WafDetectController } from './waf-detect.controller.js';
import { WafDetectService } from './waf-detect.service.js';

@Module({
  controllers: [WafDetectController],
  providers: [WafDetectService],
})
export class WafDetectModule {}
