import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { WifiService } from './wifi.service.js';

describe('WifiService', () => {
  it('refuses to scan when local tools are disabled', () => {
    const service = new WifiService({
      get: () => false,
    } as unknown as ConfigService<never, true>);
    expect(() => service.scan()).toThrow(ServiceUnavailableException);
  });
});
