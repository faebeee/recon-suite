import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { findExecutable } from './find-executable.js';

describe('findExecutable', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'find-exec-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('finds an executable file on PATH', () => {
    const file = join(dir, 'tool');
    writeFileSync(file, '');
    chmodSync(file, 0o755);
    expect(
      findExecutable('tool', {
        path: ['/nope', dir].join(delimiter),
        platform: 'linux',
      }),
    ).toBe(file);
  });

  it('ignores non-executable files and missing commands', () => {
    writeFileSync(join(dir, 'plain'), '');
    chmodSync(join(dir, 'plain'), 0o644);
    expect(
      findExecutable('plain', { path: dir, platform: 'linux' }),
    ).toBeUndefined();
    expect(
      findExecutable('missing', { path: dir, platform: 'linux' }),
    ).toBeUndefined();
  });

  it('applies PATHEXT on Windows', () => {
    writeFileSync(join(dir, 'netsh.EXE'), '');
    expect(
      findExecutable('netsh', {
        path: dir,
        pathExt: '.EXE',
        platform: 'win32',
      }),
    ).toBe(join(dir, 'netsh.EXE'));
  });
});
