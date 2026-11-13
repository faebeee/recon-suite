import {
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import type { TargetGuardService } from '../../core/net/target-guard.service.js';
import {
  CommandFailedError,
  CommandNotFoundError,
} from '../../core/process/run-command.js';
import { KaliUnavailableError } from '../../core/process/tool-exec.js';
import type { ToolExecService } from '../../core/process/tool-exec.service.js';
import { NetworkScanService } from './network-scan.service.js';

const config = (allowPrivate = false) =>
  ({ get: () => allowPrivate }) as unknown as ConfigService<Env, true>;

const guard = (isAllowed: (address: string) => boolean = () => true) =>
  ({ isAllowed: vi.fn(isAllowed) }) as unknown as TargetGuardService;

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

const XML =
  '<nmaprun><host><status state="up" reason="echo-reply"/><address addr="10.0.0.1" addrtype="ipv4"/></host></nmaprun>';

describe('NetworkScanService', () => {
  it('scans the requested range and reports hosts that are up', async () => {
    const e = exec(async () => XML);
    const out = await new NetworkScanService(config(true), guard(), e).scan({
      target: '10.0.0.0/24',
    });

    const [cmd, args] = e.mockRun.mock.calls[0]!;
    expect(cmd).toBe('nmap');
    expect(args.at(-1)).toBe('10.0.0.0/24');
    expect(out).toMatchObject({ network: '10.0.0.0/24', runner: 'kali' });
    expect(out.hosts).toEqual([{ ip: '10.0.0.1' }]);
    expect(out.method).toMatch(/^docker exec recon-kali nmap /);
  });

  it('rejects networks larger than the max prefix', async () => {
    await expect(
      new NetworkScanService(
        config(true),
        guard(),
        exec(async () => XML),
      ).scan({ target: '10.0.0.0/16' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects private networks unless ALLOW_PRIVATE_TARGETS is set', async () => {
    const e = exec(async () => XML);
    await expect(
      new NetworkScanService(
        config(false),
        guard(() => false),
        e,
      ).scan({ target: '192.168.1.0/24' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(e.mockRun).not.toHaveBeenCalled();
  });

  it('maps executor errors to HTTP errors', async () => {
    const svc = (err: Error, kind: 'local' | 'kali' = 'kali') =>
      new NetworkScanService(
        config(true),
        guard(),
        exec(async () => {
          throw err;
        }, kind),
      ).scan({ target: '10.0.0.0/24' });

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
    const svc = new NetworkScanService(
      config(true),
      guard(),
      exec(async () => {
        await gate;
        return XML;
      }),
    );
    const running = [
      svc.scan({ target: '10.0.0.0/24' }),
      svc.scan({ target: '10.0.0.0/24' }),
    ];
    await vi.waitFor(() => expect(svc['running']).toBe(2));
    await expect(svc.scan({ target: '10.0.0.0/24' })).rejects.toBeInstanceOf(
      HttpException,
    );
    release();
    await Promise.all(running);
    await expect(svc.scan({ target: '10.0.0.0/24' })).resolves.toMatchObject({
      network: '10.0.0.0/24',
    });
  });
});
