import { BadRequestException } from '@nestjs/common';
import type { ToolExecService } from '../../core/process/tool-exec.service.js';
import { HostScanService } from './host-scan.service.js';

const service = () =>
  new HostScanService({
    target: { kind: 'local' },
    run: vi.fn(),
  } as unknown as ToolExecService);

describe('HostScanService', () => {
  it('rejects interfaces the OS did not report', async () => {
    const s = service();
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
