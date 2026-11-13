import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ToolExecService } from '../../core/process/tool-exec.service.js';
import { HostScanService } from './host-scan.service.js';

const service = (enabled: boolean) =>
  new HostScanService(
    { get: () => enabled } as unknown as ConfigService<never, true>,
    { target: { kind: 'local' }, run: vi.fn() } as unknown as ToolExecService,
  );

describe('HostScanService', () => {
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
