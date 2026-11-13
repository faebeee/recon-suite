import { envSchema } from '../../config/env.js';
import {
  buildChecks,
  countTools,
  describeSettings,
  overallStatus,
} from './system-overview.js';

const defaults = envSchema.parse({});
const env = (raw: Record<string, string>) => envSchema.parse(raw);
const tools = countTools(['ok', 'ok', 'limited']);
const check = (checks: ReturnType<typeof buildChecks>, id: string) =>
  checks.find((c) => c.id === id)!;

describe('describeSettings', () => {
  it('never exposes secret values', () => {
    const settings = describeSettings(
      env({
        ADMIN_PASSWORD: 'correct horse battery',
        API_TOKEN: 'x'.repeat(40),
        NVD_API_KEY: 'nvd-secret',
      }),
      defaults,
    );
    const json = JSON.stringify(settings);
    expect(json).not.toContain('correct horse battery');
    expect(json).not.toContain('x'.repeat(40));
    expect(json).not.toContain('nvd-secret');
    expect(settings.find((s) => s.key === 'API_TOKEN')).toMatchObject({
      secret: true,
      isSet: true,
      value: undefined,
      isDefault: false,
    });
  });

  it('shows plain values and whether they are the default', () => {
    const settings = describeSettings(env({ PORT: '4100' }), defaults);
    expect(settings.find((s) => s.key === 'PORT')).toMatchObject({
      value: '4100',
      isDefault: false,
    });
    expect(
      settings.find((s) => s.key === 'ALLOW_PRIVATE_TARGETS'),
    ).toMatchObject({ value: 'false', isDefault: true });
    expect(settings.find((s) => s.key === 'KALI_CONTAINER')).toMatchObject({
      isSet: false,
      value: undefined,
    });
  });

  it('describes every environment variable', () => {
    expect(
      describeSettings(defaults, defaults)
        .map((s) => s.key)
        .sort(),
    ).toEqual(Object.keys(envSchema.shape).sort());
  });
});

describe('buildChecks', () => {
  it('flags weakened security settings as warnings', () => {
    const checks = buildChecks({
      env: env({
        ALLOW_PRIVATE_TARGETS: 'true',
        COOKIE_SECURE: 'false',
        ADMIN_PASSWORD: 'correct horse battery',
      }),
      database: { ok: true },
      tools,
    });
    expect(check(checks, 'private-targets').status).toBe('warn');
    expect(check(checks, 'cookie').status).toBe('warn');
    expect(check(checks, 'auth').status).toBe('warn');
    expect(overallStatus(checks)).toBe('warn');
  });

  it('is ok with the recommended configuration and optional parts off', () => {
    const checks = buildChecks({
      env: env({ ADMIN_PASSWORD_HASH: '$scrypt$abc' }),
      database: { ok: true },
      tools,
    });
    expect(check(checks, 'kali').status).toBe('off');
    expect(check(checks, 'nvd').status).toBe('off');
    expect(overallStatus(checks)).toBe('ok');
  });

  it('reports database and Kali failures as errors', () => {
    const checks = buildChecks({
      env: env({ KALI_CONTAINER: 'recon-kali' }),
      kali: { state: 'missing' },
      database: { ok: false, error: 'disk I/O error' },
      tools,
    });
    expect(check(checks, 'database')).toMatchObject({ status: 'error' });
    expect(check(checks, 'kali')).toMatchObject({ status: 'error' });
    expect(check(checks, 'kali').fix).toMatch(/compose:up/);
    expect(overallStatus(checks)).toBe('error');
  });

  it('treats a missing container as recoverable when KALI_IMAGE is set', () => {
    const checks = buildChecks({
      env: env({ KALI_CONTAINER: 'recon-kali', KALI_IMAGE: 'kali:latest' }),
      kali: { state: 'missing' },
      database: { ok: true },
      tools,
    });
    expect(check(checks, 'kali').status).toBe('warn');
  });

  it('warns when tools are unavailable', () => {
    const checks = buildChecks({
      env: defaults,
      database: { ok: true },
      tools: countTools(['ok', 'unavailable']),
    });
    expect(check(checks, 'tools')).toMatchObject({
      status: 'warn',
      detail: '1/2 fully supported, 1 unavailable.',
    });
  });
});
