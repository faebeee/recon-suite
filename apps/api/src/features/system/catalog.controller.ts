import { Public } from '@nestjs/authentication';
import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { TOOL_LIST, type ToolMeta } from '@recon/shared';

@Public()
@SkipThrottle()
@Controller('tools')
export class CatalogController {
  @Get()
  list(): ToolMeta[] {
    return TOOL_LIST;
  }
}
