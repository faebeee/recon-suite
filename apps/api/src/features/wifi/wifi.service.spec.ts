import { BadRequestException } from '@nestjs/common';
import { WifiService } from './wifi.service.js';

const service = () => new WifiService();

describe('WifiService', () => {
  it('rejects interfaces the OS did not report', async () => {
    const s = service();
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
