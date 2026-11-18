import { Controller, Get } from '@nestjs/common';
import { TOOL_LIST, type ToolMeta } from '@recon/shared';

@Controller('tools')
export class CatalogController {
  @Get()
  list(): ToolMeta[] {
    return TOOL_LIST;
  }
}
