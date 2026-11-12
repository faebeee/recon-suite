import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isBlockedAddress } from './blocked-ranges.js';
import { TargetGuardService } from './target-guard.service.js';

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fe80::1',
    'fd00::1',
    '::ffff:10.0.0.1',
    'not-an-ip',
  ])('blocks %s', (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(['1.1.1.1', '8.8.8.8', '93.184.215.14', '2606:4700::1111'])(
    'allows %s',
    (ip) => expect(isBlockedAddress(ip)).toBe(false),
  );
});

describe('TargetGuardService', () => {
  const guard = (allow: boolean) =>
    new TargetGuardService({
      get: () => allow,
    } as unknown as ConfigService<never, true>);

  it('rejects private IP literals by default', async () => {
    await expect(guard(false).resolve('10.0.0.1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('accepts private IP literals when allowed', async () => {
    await expect(guard(true).resolve('10.0.0.1')).resolves.toEqual({
      host: '10.0.0.1',
      addresses: ['10.0.0.1'],
    });
  });
});
