import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { GatewayTimeoutException } from '@nestjs/common';
import { CommandFailedError, runCommand } from '../process/run-command.js';

/**
 * ReconHelper.app (apps/api/native/macos): a signed app bundle that holds the macOS privacy
 * permissions CLI tools can't get (Location -> WiFi names, Bluetooth -> BT scanning).
 * Built by `npm run setup:macos-helper`.
 */
export const HELPER_APP = resolve(
  import.meta.dirname,
  '../../../native/macos/build/ReconHelper.app',
);

export const HELPER_SETUP_COMMAND = 'npm run setup:macos-helper';

export type HelperMode = 'wifi' | 'bluetooth';

/** Fields every helper response has. */
export interface HelperStatus {
  authorized: boolean;
  status: string;
  error?: string;
}

export function helperInstalled(): boolean {
  return existsSync(join(HELPER_APP, 'Contents/MacOS/ReconHelper'));
}

/**
 * Runs the helper through LaunchServices (`open`) so macOS attributes the permission to the
 * helper app, not to node. Scan modes never prompt. `args` must be fixed or validated values.
 */
export async function runHelper<T extends HelperStatus>(
  mode: HelperMode,
  args: readonly string[],
  timeoutMs: number,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'reconhelper-'));
  const output = join(dir, 'result.json');
  const deadline = Date.now() + timeoutMs;
  try {
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
          '--mode',
          mode,
          '--output',
          output,
          ...args,
        ],
        { timeoutMs },
      );
    } catch (err) {
      // `open -W` can complain when the helper exits very quickly; the result file decides.
      if (!(err instanceof CommandFailedError) || err.timedOut) throw err;
    }
    // `open -W` may return before the helper finishes; wait for its (atomic) result file.
    while (!(await exists(output))) {
      if (Date.now() > deadline) {
        throw new GatewayTimeoutException(
          'macOS helper did not respond in time',
        );
      }
      await sleep(200);
    }
    return JSON.parse(await readFile(output, 'utf8')) as T;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}
