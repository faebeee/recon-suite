import { applyPortOverrides, validateEnv } from './env.js';

describe('applyPortOverrides', () => {
  it('leaves the config alone without API_PORT/WEB_PORT', () => {
    const config = { PORT: '4000', CORS_ORIGIN: 'http://localhost:5173' };
    expect(applyPortOverrides(config)).toEqual(config);
  });

  it('lets API_PORT win over PORT (e.g. from .env)', () => {
    expect(validateEnv({ PORT: '4000', API_PORT: '4111' }).PORT).toBe(4111);
  });

  it('adds the local web origins for WEB_PORT to CORS_ORIGIN', () => {
    expect(
      validateEnv({ CORS_ORIGIN: 'http://localhost:5173', WEB_PORT: '4222' })
        .CORS_ORIGIN,
    ).toBe('http://localhost:5173,http://localhost:4222,http://127.0.0.1:4222');
  });

  it('replaces the default origin when only WEB_PORT is set', () => {
    expect(validateEnv({ WEB_PORT: '4222' }).CORS_ORIGIN).toBe(
      'http://localhost:4222,http://127.0.0.1:4222',
    );
  });

  it('does not duplicate origins that are already allowed', () => {
    expect(
      validateEnv({
        CORS_ORIGIN: 'http://localhost:4222, http://192.168.1.20:4222',
        WEB_PORT: '4222',
      }).CORS_ORIGIN,
    ).toBe(
      'http://localhost:4222,http://192.168.1.20:4222,http://127.0.0.1:4222',
    );
  });

  it('ignores empty values', () => {
    expect(validateEnv({ API_PORT: '', WEB_PORT: ' ' })).toMatchObject({
      PORT: 4000,
      CORS_ORIGIN: 'http://localhost:5173',
    });
  });
});
