import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { WifiService } from './wifi.service.js';

const service = (enabled: boolean) =>
  new WifiService({ get: () => enabled } as unknown as ConfigService<
    never,
    true
  >);

describe('WifiService', () => {
  it('refuses to work when local tools are disabled', async () => {
    await expect(service(false).listInterfaces()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service(false).scan({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects interfaces the OS did not report', async () => {
    const s = service(true);
    vi.spyOn(s, 'listInterfaces').mockResolvedValue({
      platform: 'linux',
      interfaces: [{ name: 'wlan0' }],
      defaultInterface: 'wlan0',
    });
    await expect(s.scan({ interface: 'eth0' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
