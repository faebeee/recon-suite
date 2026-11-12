import { z } from 'zod';

/** Search params every tool route accepts: /tools/dns?target=example.com */
export const toolSearchSchema = z.object({
  target: z.string().optional(),
});
