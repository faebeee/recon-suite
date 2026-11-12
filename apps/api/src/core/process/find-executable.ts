import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/**
 * Looks up a command on PATH without running it (no shell, no process spawn).
 * Returns the absolute path, or undefined when it is not installed.
 */
export function findExecutable(
  command: string,
  {
    path = process.env.PATH ?? '',
    pathExt = process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM',
    platform = process.platform,
  }: { path?: string; pathExt?: string; platform?: NodeJS.Platform } = {},
): string | undefined {
  const extensions =
    platform === 'win32' ? ['', ...pathExt.split(';').filter(Boolean)] : [''];
  for (const dir of path.split(delimiter).filter(Boolean)) {
    for (const ext of extensions) {
      const candidate = join(dir, command + ext);
      if (isExecutable(candidate, platform)) return candidate;
    }
  }
  return undefined;
}

function isExecutable(file: string, platform: NodeJS.Platform): boolean {
  try {
    if (!statSync(file).isFile()) return false;
    // Windows has no execute bit; PATHEXT decides what is runnable.
    if (platform !== 'win32') accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
