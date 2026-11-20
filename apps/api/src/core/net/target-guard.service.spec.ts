import { TargetGuardService } from './target-guard.service.js';

describe('TargetGuardService', () => {
  it.each(['10.0.0.1', '127.0.0.1', '169.254.169.254', '::1', '8.8.8.8'])(
    'passes IP literal %s through',
    async (ip) => {
      await expect(new TargetGuardService().resolve(ip)).resolves.toEqual({
        host: ip,
        addresses: [ip],
      });
    },
  );
});
