import { targetsOf } from './run-capture.interceptor.js';

describe('targetsOf', () => {
  it('collects the target and extra hosts for scope checks', () => {
    expect(
      targetsOf({ target: ' example.com ', hosts: ['a.example.com', 3, ''] }),
    ).toEqual(['example.com', 'a.example.com']);
    expect(targetsOf({})).toEqual([]);
    expect(targetsOf(undefined)).toEqual([]);
  });
});
