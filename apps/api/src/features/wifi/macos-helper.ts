import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runCommand } from '../../core/process/run-command.js';
import type { CoreWlanResult } from './wifi.parsers.js';

/** Built by `pnpm setup:wifi-macos` (apps/api/native/macos/build.sh). */
export const HELPER_APP = resolve(
  import.meta.dirname,
  '../../../native/macos/build/ReconWifi.app',
);

export const HELPER_SETUP_COMMAND = 'pnpm setup:wifi-macos';

export function helperInstalled(): boolean {
  return existsSync(join(HELPER_APP, 'Contents/MacOS/ReconWifi'));
}

/**
 * Runs the helper through LaunchServices (`open`), so macOS attributes the Location
 * permission to the helper app and not to node. The helper never prompts in scan mode.
 */
export async function runHelperScan(
  interfaceName: string,
): Promise<CoreWlanResult> {
  const dir = await mkdtemp(join(tmpdir(), 'reconwifi-'));
  const output = join(dir, 'result.json');
  try {
    await runCommand(
      'open',
      [
        '-n',
        '-W',
        '-g',
        '-j',
        '-a',
        HELPER_APP,
        '--args',
        '--output',
        output,
        '--interface',
        interfaceName,
      ],
      { timeoutMs: 30_000 },
    );
    return JSON.parse(await readFile(output, 'utf8')) as CoreWlanResult;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
