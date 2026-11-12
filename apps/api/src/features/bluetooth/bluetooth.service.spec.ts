import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { BluetoothService } from './bluetooth.service.js';

describe('BluetoothService', () => {
  it('refuses to scan when local tools are disabled', () => {
    const service = new BluetoothService({
      get: () => false,
    } as unknown as ConfigService<never, true>);
    expect(() => service.scan({ transport: 'both', durationSec: 4 })).toThrow(
      ServiceUnavailableException,
    );
  });
});
