import type { ConfigService } from '@nestjs/config';
import { PasswordHasher } from '@nestjs/authentication';
import type { Env } from '../../config/env.js';
import { AuthSettings } from './auth-settings.service.js';
import { isLoopback } from './request-source.js';

const settings = (env: Partial<Env>) =>
  new AuthSettings({
    get: (k: keyof Env) => env[k],
  } as unknown as ConfigService<Env, true>);

describe('isLoopback', () => {
  it.each([
    ['127.0.0.1', true],
    ['127.10.0.3', true],
    ['::1', true],
    ['::ffff:127.0.0.1', true],
    ['10.0.0.1', false],
    ['::ffff:172.17.0.2', false],
    [undefined, false],
  ])('%s -> %s', (addr, expected) => {
    expect(isLoopback(addr)).toBe(expected);
  });
});

describe('AuthSettings', () => {
  it('is open without a password and rejects any API token without API_TOKEN', async () => {
    const s = settings({});
    await s.onModuleInit();
    expect(s.passwordConfigured).toBe(false);
    expect(s.verifyApiToken('anything')).toBe(false);
  });

  it('hashes a plain ADMIN_PASSWORD at startup and verifies it', async () => {
    const s = settings({ ADMIN_PASSWORD: 'correct-horse-battery' });
    await s.onModuleInit();
    expect(s.passwordConfigured).toBe(true);
    expect(await s.verifyPassword('correct-horse-battery')).toBe(true);
    expect(await s.verifyPassword('wrong')).toBe(false);
  }, 20_000);

  it('accepts a precomputed ADMIN_PASSWORD_HASH', async () => {
    const hash = await new PasswordHasher({ logN: 10 }).hash(
      'another-long-secret',
    );
    const s = settings({ ADMIN_PASSWORD_HASH: hash });
    await s.onModuleInit();
    expect(await s.verifyPassword('another-long-secret')).toBe(true);
  }, 20_000);

  it('compares API tokens exactly', () => {
    const token = 'x'.repeat(40);
    const s = settings({ API_TOKEN: token });
    expect(s.verifyApiToken(token)).toBe(true);
    expect(s.verifyApiToken(`${token}y`)).toBe(false);
  });
});
