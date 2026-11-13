import { checkScope, parseScopeValue, type ScopeRule } from './scope.js';

const rule = (raw: string, excluded = false): ScopeRule => ({
  ...parseScopeValue(raw),
  excluded,
});

describe('parseScopeValue', () => {
  it('recognises every kind', () => {
    expect(parseScopeValue('Example.COM')).toEqual({
      kind: 'domain',
      value: 'example.com',
    });
    expect(parseScopeValue('https://www.example.com/login')).toEqual({
      kind: 'domain',
      value: 'www.example.com',
    });
    expect(parseScopeValue('*.example.com')).toEqual({
      kind: 'wildcard',
      value: '*.example.com',
    });
    expect(parseScopeValue('192.0.2.10')).toEqual({
      kind: 'ip',
      value: '192.0.2.10',
    });
    expect(parseScopeValue('2001:db8::/32')).toEqual({
      kind: 'cidr',
      value: '2001:db8::/32',
    });
  });

  it('rejects garbage', () => {
    expect(() => parseScopeValue('not a host')).toThrow(/not a domain/);
    expect(() => parseScopeValue('10.0.0.0/40')).toThrow(/CIDR/);
  });
});

describe('checkScope', () => {
  const rules = [
    rule('example.com'),
    rule('*.example.com'),
    rule('legacy.example.com', true),
    rule('192.0.2.0/24'),
    rule('2001:db8::1'),
  ];

  it.each([
    ['example.com', true],
    ['https://api.example.com/v1', true],
    ['a.b.example.com', true],
    ['legacy.example.com', false],
    ['notexample.com', false],
    ['192.0.2.77', true],
    ['198.51.100.1', false],
    ['2001:0db8:0:0:0:0:0:1', true],
  ])('%s -> %s', (target, expected) => {
    expect(checkScope(rules, target).inScope).toBe(expected);
  });

  it('explains an empty scope', () => {
    expect(checkScope([], 'example.com')).toEqual({
      inScope: false,
      reason: 'The engagement has no scope entries yet',
    });
  });

  it('wildcards do not include the apex', () => {
    expect(checkScope([rule('*.example.com')], 'example.com').inScope).toBe(
      false,
    );
  });
});
