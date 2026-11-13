import { CommandFailedError, CommandNotFoundError } from './run-command.js';
import {
  buildKaliExec,
  buildKaliRun,
  buildKaliStart,
  classifyKaliFailure,
  KaliUnavailableError,
  mapKaliError,
} from './tool-exec.js';

const kali = { kind: 'kali', cli: 'docker', container: 'recon-kali' } as const;

describe('buildKaliExec', () => {
  it('wraps the command in an in-container timeout', () => {
    expect(buildKaliExec(kali, 'nmap', ['-sT', '192.0.2.1'], 30_500)).toEqual({
      command: 'docker',
      args: [
        'exec',
        'recon-kali',
        'timeout',
        '-k',
        '5',
        '31',
        'nmap',
        '-sT',
        '192.0.2.1',
      ],
    });
  });

  it('rejects container names that could be read as options', () => {
    expect(() =>
      buildKaliExec({ ...kali, container: '--privileged' }, 'ip', [], 1000),
    ).toThrow(/Invalid container name/);
  });
});

describe('mapKaliError', () => {
  it('reports a missing CLI or container as Kali unavailable', () => {
    expect(
      mapKaliError(new CommandNotFoundError('docker'), kali, 'nmap'),
    ).toBeInstanceOf(KaliUnavailableError);
    expect(
      mapKaliError(
        new CommandFailedError(
          'docker',
          'Error response from daemon: No such container: recon-kali',
          false,
          1,
        ),
        kali,
        'nmap',
      ),
    ).toBeInstanceOf(KaliUnavailableError);
  });

  it('maps exit 127 to a missing command inside the container', () => {
    const mapped = mapKaliError(
      new CommandFailedError('docker', '', false, 127),
      kali,
      'nmap',
    );
    expect(mapped).toBeInstanceOf(CommandNotFoundError);
    expect((mapped as CommandNotFoundError).command).toBe('nmap');
  });

  it('maps exit 124 to a timeout of the inner command', () => {
    const mapped = mapKaliError(
      new CommandFailedError('docker', '', false, 124),
      kali,
      'nmap',
    ) as CommandFailedError;
    expect(mapped.timedOut).toBe(true);
    expect(mapped.command).toBe('nmap');
  });
});

describe('classifyKaliFailure', () => {
  const fail = (stderr: string) =>
    new CommandFailedError('docker', stderr, false, 1);
  it.each([
    ['Error response from daemon: No such container: recon-kali', 'missing'],
    ['Error: no container with name or ID "recon-kali" found', 'missing'],
    ['Error response from daemon: container 8403 is not running', 'stopped'],
    [
      'Error: can only create exec sessions on running containers: container state improper',
      'stopped',
    ],
    ['Cannot connect to the Docker daemon at unix:///run/x.sock', 'engine'],
    ['nmap: something else', undefined],
  ])('%s -> %s', (stderr, expected) => {
    expect(classifyKaliFailure(fail(stderr))).toBe(expected);
  });
});

describe('buildKaliRun / buildKaliStart', () => {
  it('creates the container with fixed flags and no pull', () => {
    const run = buildKaliRun(kali, 'localhost/recon-suite/kali:latest');
    expect(run.args.slice(0, 4)).toEqual(['run', '-d', '--name', 'recon-kali']);
    expect(run.args).toContain('never');
    expect(run.args.at(-1)).toBe('localhost/recon-suite/kali:latest');
    expect(run.args).not.toContain('--privileged');
    expect(buildKaliStart(kali).args).toEqual(['start', 'recon-kali']);
  });

  it('rejects image references that could be read as options', () => {
    expect(() => buildKaliRun(kali, '--privileged')).toThrow(/Invalid image/);
  });
});
