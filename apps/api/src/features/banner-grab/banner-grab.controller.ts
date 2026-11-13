import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  bannerGrabInputSchema,
  type BannerGrabOutput,
  type BannerGrabParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { BannerGrabService } from './banner-grab.service.js';

@Controller('tools/banner-grab')
export class BannerGrabController {
  constructor(private readonly service: BannerGrabService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: bannerGrabInputSchema }) input: BannerGrabParams,
  ): Promise<ToolResult<BannerGrabOutput>> {
    return runTool('banner-grab', input.target, () => this.service.grab(input));
  }
}
