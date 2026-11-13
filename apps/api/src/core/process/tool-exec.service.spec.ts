import type { ConfigService } from '@nestjs/config';
import { CommandFailedError } from './run-command.js';
import { KaliUnavailableError } from './tool-exec.js';
import { ToolExecService } from './tool-exec.service.js';

type Call = { command: string; args: readonly string[] };

const NOT_RUNNING = new CommandFailedError(
  'docker',
  'Error response from daemon: container abc is not running',
  false,
  1,
);
const MISSING = new CommandFailedError(
  'docker',
  'Error response from daemon: No such container: recon-kali',
  false,
  1,
);

/** ToolExecService with a scripted command runner (no processes are spawned). */
function service(
  env: Record<string, string | undefined>,
  respond: (call: Call, index: number) => Promise<string>,
) {
  const calls: Call[] = [];
  class TestExec extends ToolExecService {
    protected override command(command: string, args: readonly string[]) {
      const call = { command, args };
      calls.push(call);
      return respond(call, calls.length - 1);
    }
  }
  const config = {
    get: (key: string) => (key === 'CONTAINER_CLI' ? 'docker' : env[key]),
  } as unknown as ConfigService<never, true>;
  return { svc: new TestExec(config), calls };
}

const KALI = { KALI_CONTAINER: 'recon-kali' };
const verb = (c: Call) => c.args[0];

describe('ToolExecService', () => {
  it('runs locally without KALI_CONTAINER', async () => {
    const { svc, calls } = service({}, async () => 'out');
    await expect(svc.run('nmap', ['-V'])).resolves.toBe('out');
    expect(calls).toEqual([{ command: 'nmap', args: ['-V'] }]);
  });

  it('starts a stopped container and retries the command', async () => {
    let started = false;
    const { svc, calls } = service(KALI, async (call) => {
      if (verb(call) === 'start') {
        started = true;
        return 'recon-kali';
      }
      if (!started) throw NOT_RUNNING;
      return 'xml';
    });
    await expect(svc.run('nmap', ['-V'])).resolves.toBe('xml');
    expect(calls.map(verb)).toEqual(['exec', 'start', 'exec']);
    expect(calls[1]!.args).toEqual(['start', 'recon-kali']);
  });

  it('creates a missing container from KALI_IMAGE', async () => {
    let created = false;
    const { svc, calls } = service(
      { ...KALI, KALI_IMAGE: 'localhost/recon-suite/kali:latest' },
      async (call) => {
        if (verb(call) === 'run') {
          created = true;
          return 'id';
        }
        if (!created) throw MISSING;
        return 'xml';
      },
    );
    await expect(svc.run('nmap', ['-V'])).resolves.toBe('xml');
    expect(calls.map(verb)).toEqual(['exec', 'run', 'exec']);
    expect(calls[1]!.args.at(-1)).toBe('localhost/recon-suite/kali:latest');
  });

  it('does not create a missing container without KALI_IMAGE', async () => {
    const { svc, calls } = service(KALI, async () => {
      throw MISSING;
    });
    await expect(svc.run('nmap', [])).rejects.toThrow(/KALI_IMAGE is not set/);
    expect(calls.map(verb)).toEqual(['exec']);
  });

  it('falls back to start when the container appeared meanwhile', async () => {
    let started = false;
    const { svc, calls } = service(
      { ...KALI, KALI_IMAGE: 'kali:latest' },
      async (call) => {
        if (verb(call) === 'run') {
          throw new CommandFailedError(
            'docker',
            'Conflict. The container name "/recon-kali" is already in use',
            false,
            125,
          );
        }
        if (verb(call) === 'start') {
          started = true;
          return '';
        }
        if (!started) throw MISSING;
        return 'ok';
      },
    );
    await expect(svc.run('ip', [])).resolves.toBe('ok');
    expect(calls.map(verb)).toEqual(['exec', 'run', 'start', 'exec']);
  });

  it('reports a failed start and does not loop', async () => {
    const { svc, calls } = service(KALI, async (call) => {
      if (verb(call) === 'start') {
        throw new CommandFailedError('docker', 'Error: boom', false, 1);
      }
      throw NOT_RUNNING;
    });
    const err = await svc.run('nmap', []).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KaliUnavailableError);
    expect((err as Error).message).toContain('Could not start');
    expect(calls.map(verb)).toEqual(['exec', 'start']);
  });

  it('retries only once when the container stops again', async () => {
    const { svc, calls } = service(KALI, async (call) => {
      if (verb(call) === 'start') return '';
      throw NOT_RUNNING;
    });
    await expect(svc.run('nmap', [])).rejects.toBeInstanceOf(
      KaliUnavailableError,
    );
    expect(calls.map(verb)).toEqual(['exec', 'start', 'exec']);
  });

  it('shares one start between concurrent requests', async () => {
    let started = false;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { svc, calls } = service(KALI, async (call) => {
      if (verb(call) === 'start') {
        await gate;
        started = true;
        return '';
      }
      if (!started) throw NOT_RUNNING;
      return 'ok';
    });
    const both = Promise.all([svc.run('nmap', []), svc.run('ip', [])]);
    await vi.waitFor(() =>
      expect(calls.filter((c) => verb(c) === 'exec')).toHaveLength(2),
    );
    release();
    await expect(both).resolves.toEqual(['ok', 'ok']);
    expect(calls.filter((c) => verb(c) === 'start')).toHaveLength(1);
  });
});
