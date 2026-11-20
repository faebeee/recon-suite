import { ToolExecService } from './tool-exec.service.js';
import type { ExecCommand } from './tool-exec.js';

type Call = {
  command: string;
  args: readonly string[];
  timeoutMs: number | null;
};

/** ToolExecService with a scripted command runner (no processes are spawned). */
function service() {
  const calls: Call[] = [];
  class TestExec extends ToolExecService {
    protected override command(
      command: string,
      args: readonly string[],
      timeoutMs: number | null,
    ) {
      calls.push({ command, args, timeoutMs });
      return Promise.resolve('out');
    }
  }
  return { svc: new TestExec(), calls };
}

describe('ToolExecService', () => {
  it('runs allowed commands with the given arguments', async () => {
    const { svc, calls } = service();
    await expect(svc.run('nmap', ['-V'])).resolves.toBe('out');
    expect(calls).toEqual([
      { command: 'nmap', args: ['-V'], timeoutMs: 20_000 },
    ]);
  });

  it('passes "no time limit" through', async () => {
    const { svc, calls } = service();
    await svc.run('nmap', ['-sn', '10.0.0.0/24'], { timeoutMs: null });
    expect(calls[0]!.timeoutMs).toBeNull();
  });

  it('refuses commands outside the closed list', () => {
    const { svc, calls } = service();
    expect(() => svc.run('sh' as ExecCommand, ['-c', 'id'])).toThrow(
      /not allowed/,
    );
    expect(calls).toEqual([]);
  });
});
