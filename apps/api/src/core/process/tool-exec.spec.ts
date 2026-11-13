import { CommandFailedError, CommandNotFoundError } from './run-command.js';
import {
  buildKaliExec,
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
      'arp-scan',
    );
    expect(mapped).toBeInstanceOf(CommandNotFoundError);
    expect((mapped as CommandNotFoundError).command).toBe('arp-scan');
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
