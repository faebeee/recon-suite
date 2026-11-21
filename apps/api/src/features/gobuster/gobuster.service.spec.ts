import { existsSync, readFileSync } from 'node:fs';
import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { gobusterInputSchema } from '@recon/shared';
import type { TargetGuardService } from '../../core/net/target-guard.service.js';
import {
  CommandFailedError,
  CommandNotFoundError,
} from '../../core/process/run-command.js';
import type { ToolExecService } from '../../core/process/tool-exec.service.js';
import { GobusterService } from './gobuster.service.js';
import type { WordlistFs } from './gobuster.wordlists.js';

const DIRB = '/usr/share/wordlists/dirb/common.txt';

const guard = {
  resolve: vi.fn(async (host: string) => ({
    host,
    addresses: ['192.0.2.10'],
  })),
} as unknown as TargetGuardService;

/** A host with only dirb's common.txt installed. */
const fs: WordlistFs = {
  isFile: (p) => p === DIRB,
  countLines: () => 4614,
};

type Run = (args: readonly string[]) => Promise<string>;
function setup(run: Run, installed = true) {
  const exec = {
    run: vi.fn((_cmd: string, args: readonly string[], _opts?: unknown) =>
      run(args),
    ),
  };
  const svc = new GobusterService(
    guard,
    exec as unknown as ToolExecService,
  ).useHost(fs, installed);
  return { svc, exec };
}

const params = (input: Record<string, unknown>) =>
  gobusterInputSchema.parse({ target: 'https://x.test', ...input });

describe('GobusterService', () => {
  it('lists built-in and installed wordlists only', () => {
    const { svc } = setup(async () => '');
    const out = svc.listWordlists();
    expect(out.installed).toBe(true);
    expect(out.wordlists.map((w) => w.id)).toEqual([
      'builtin-quick',
      'builtin-common',
      'dirb-common',
    ]);
    expect(out.wordlists[2]).toMatchObject({ path: DIRB, lines: 4614 });
  });

  it('runs gobuster on the resolved IP with an installed wordlist', async () => {
    const { svc, exec } = setup(
      async () => '/admin                (Status: 403) [Size: 199]\n',
    );
    const out = await svc.scan(
      params({ wordlist: 'dirb-common', timeLimitMinutes: 5 }),
    );
    const [cmd, args, opts] = exec.run.mock.calls[0]!;
    expect(cmd).toBe('gobuster');
    expect(args).toEqual(
      expect.arrayContaining([
        'https://192.0.2.10/',
        DIRB,
        'Host: x.test',
        '--no-tls-validation',
      ]),
    );
    expect(args).not.toContain('https://x.test/');
    expect(opts).toEqual({ timeoutMs: 300_000 });
    expect(out).toMatchObject({
      base: 'https://x.test/',
      address: '192.0.2.10',
      wordlist: { id: 'dirb-common', lines: 4614 },
      hits: [{ path: '/admin', status: 403, url: 'https://x.test/admin' }],
    });
    expect(out.stopped).toBeUndefined();
  });

  it('writes a built-in list to a temp file and removes it afterwards', async () => {
    let path = '';
    let content = '';
    const { svc } = setup(async (args) => {
      path = args[args.indexOf('--wordlist') + 1]!;
      content = readFileSync(path, 'utf8');
      return '';
    });
    await svc.scan(params({ wordlist: 'builtin-quick' }));
    expect(content.split('\n')).toContain('admin');
    expect(existsSync(path)).toBe(false);
  });

  it('keeps the partial output when the time limit kills gobuster', async () => {
    const { svc } = setup(async () => {
      throw new CommandFailedError(
        'gobuster',
        '',
        true,
        undefined,
        '/api                  (Status: 200) [Size: 12]\n',
      );
    });
    const out = await svc.scan(params({}));
    expect(out.stopped).toBe('time-limit');
    expect(out.hits.map((h) => h.path)).toEqual(['/api']);
  });

  it('rejects unknown or not installed wordlists before running anything', async () => {
    const { svc, exec } = setup(async () => '');
    await expect(
      svc.scan(params({ wordlist: 'seclists-common' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(exec.run).not.toHaveBeenCalled();
  });

  it('maps a missing binary and gobuster errors to readable messages', async () => {
    const missing = setup(async () => {
      throw new CommandNotFoundError('gobuster');
    });
    await expect(missing.svc.scan(params({}))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    const wildcard = setup(async () => {
      throw new CommandFailedError(
        'gobuster',
        'Error: the server returns a status code that matches the provided options for non existing urls. https://192.0.2.10/x => 200 (Length: 1534).',
        false,
        1,
      );
    });
    const err = await wildcard.svc.scan(params({})).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadGatewayException);
    expect((err as Error).message).toMatch(/Add 1534 to "Exclude lengths"/);
  });

  it('accepts only wordlist ids, never paths', () => {
    for (const wordlist of ['/etc/passwd', '../x', 'a b']) {
      expect(
        gobusterInputSchema.safeParse({ target: 'https://x.test', wordlist })
          .success,
      ).toBe(false);
    }
  });
});
