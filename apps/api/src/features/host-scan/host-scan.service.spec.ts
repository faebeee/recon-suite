import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { HostScanService } from './host-scan.service.js';

const service = (enabled: boolean) =>
  new HostScanService({ get: () => enabled } as unknown as ConfigService<
    never,
    true
  >);

describe('HostScanService', () => {
  it('refuses to work when local tools are disabled', async () => {
    expect(() => service(false).listInterfaces()).toThrow(
      ServiceUnavailableException,
    );
    await expect(service(false).scan({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects interfaces the OS did not report', async () => {
    const s = service(true);
    vi.spyOn(s, 'listInterfaces').mockReturnValue({
      interfaces: [
        { name: 'wlan0', address: '192.168.1.5', netmask: '', cidr: '' },
      ],
      defaultInterface: 'wlan0',
    });
    await expect(s.scan({ interface: 'eth0' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
