import {
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { TargetGuardService } from '../../core/net/target-guard.service.js';
import {
  CommandFailedError,
  CommandNotFoundError,
} from '../../core/process/run-command.js';
import { KaliUnavailableError } from '../../core/process/tool-exec.js';
import type { ToolExecService } from '../../core/process/tool-exec.service.js';
import { NmapService } from './nmap.service.js';

const guard = (resolve: (host: string) => Promise<{ addresses: string[] }>) =>
  ({ resolve: vi.fn(resolve) }) as unknown as TargetGuardService;

const exec = (
  run: (cmd: string, args: readonly string[]) => Promise<string>,
  kind: 'local' | 'kali' = 'kali',
) => {
  const fake = {
    target:
      kind === 'kali'
        ? { kind, cli: 'docker', container: 'recon-kali' }
        : { kind },
    via: kind === 'kali' ? 'docker exec recon-kali' : undefined,
    run: vi.fn(run),
  };
  return Object.assign(fake as unknown as ToolExecService, {
    mockRun: fake.run,
  });
};

const params = {
  target: 'scanme.test',
  topPorts: 100 as const,
  serviceDetection: true,
};

const XML =
  '<nmaprun version="7.95"><host><status state="up"/><ports><port protocol="tcp" portid="22"><state state="open"/><service name="ssh"/></port></ports></host></nmaprun>';

describe('NmapService', () => {
  it('scans the resolved IP, never the hostname', async () => {
    const e = exec(async () => XML);
    const out = await new NmapService(
      guard(async () => ({ addresses: ['192.0.2.10'] })),
      e,
    ).scan(params);

    const [cmd, args] = e.mockRun.mock.calls[0]!;
    expect(cmd).toBe('nmap');
    expect(args.at(-1)).toBe('192.0.2.10');
    expect(args).not.toContain('scanme.test');
    expect(out).toMatchObject({
      address: '192.0.2.10',
      hostState: 'up',
      runner: 'kali',
    });
    expect(out.method).toMatch(/^docker exec recon-kali nmap /);
    expect(out.findings).toHaveLength(1);
  });

  it('does not run nmap when the guard blocks the target', async () => {
    const e = exec(async () => XML);
    await expect(
      new NmapService(
        guard(async () => {
          throw new ForbiddenException('blocked');
        }),
        e,
      ).scan({ ...params, target: '127.0.0.1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(e.mockRun).not.toHaveBeenCalled();
  });

  it('maps executor errors to HTTP errors', async () => {
    const svc = (err: Error, kind: 'local' | 'kali' = 'kali') =>
      new NmapService(
        guard(async () => ({ addresses: ['192.0.2.10'] })),
        exec(async () => {
          throw err;
        }, kind),
      ).scan(params);

    await expect(svc(new KaliUnavailableError('gone'))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(
      svc(new CommandNotFoundError('nmap'), 'local'),
    ).rejects.toThrow(/not installed on the API host/);
    await expect(
      svc(new CommandFailedError('nmap', '', true)),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);
  });

  it('limits concurrent scans', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const svc = new NmapService(
      guard(async () => ({ addresses: ['192.0.2.10'] })),
      exec(async () => {
        await gate;
        return XML;
      }),
    );
    const running = [svc.scan(params), svc.scan(params)];
    await vi.waitFor(() => expect(svc['running']).toBe(2));
    await expect(svc.scan(params)).rejects.toBeInstanceOf(HttpException);
    release();
    await Promise.all(running);
    await expect(svc.scan(params)).resolves.toMatchObject({ hostState: 'up' });
  });
});
