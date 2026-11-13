import { z } from 'zod';

/**
 * Search params every tool route accepts: /tools/dns?target=example.com
 * `run` opens a saved engagement run (RunDetail) instead of running the tool.
 */
export const toolSearchSchema = z.object({
  target: z.string().optional(),
  run: z.string().optional(),
});
