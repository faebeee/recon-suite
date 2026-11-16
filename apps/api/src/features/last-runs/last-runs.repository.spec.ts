import { openDatabase } from '../../core/db/database.js';
import {
  INTERRUPTED_MESSAGE,
  LastRunsRepository,
} from './last-runs.repository.js';

const start = (repo: LastRunsRepository, id: string, target: string) =>
  repo.start({
    id,
    tool: 'dns',
    target,
    input: { target },
    startedAt: '2026-11-13T10:00:00.000Z',
  });

const result = (target: string) => ({
  tool: 'dns' as const,
  target,
  startedAt: '2026-11-13T10:00:00.000Z',
  durationMs: 12,
  data: { ok: true },
});

describe('LastRunsRepository', () => {
  let repo: LastRunsRepository;
  beforeEach(() => {
    repo = new LastRunsRepository(openDatabase(':memory:'));
  });

  it('keeps one row per tool and replaces it with the next run', async () => {
    await start(repo, 'a', 'one.example');
    await repo.finish('dns', 'a', { result: result('one.example') });
    await start(repo, 'b', 'two.example');
    expect(await repo.get('dns')).toMatchObject({
      id: 'b',
      target: 'two.example',
      status: 'running',
      result: undefined,
      finishedAt: undefined,
    });
  });

  it('ignores a slower older run finishing after a newer one started', async () => {
    await start(repo, 'old', 'one.example');
    await start(repo, 'new', 'two.example');
    await repo.finish('dns', 'old', { result: result('one.example') });
    expect(await repo.get('dns')).toMatchObject({
      id: 'new',
      status: 'running',
    });
  });

  it('marks runs interrupted by a restart as failed', async () => {
    await start(repo, 'a', 'one.example');
    await repo.onApplicationBootstrap();
    expect(await repo.get('dns')).toMatchObject({
      status: 'error',
      error: { status: 503, message: INTERRUPTED_MESSAGE },
    });
  });

  it('summarises every tool without input or result', async () => {
    expect(await repo.summaries()).toEqual([]);
    await start(repo, 'a', 'one.example');
    await repo.finish('dns', 'a', { result: result('one.example') });
    expect(await repo.summaries()).toEqual([
      {
        tool: 'dns',
        target: 'one.example',
        status: 'ok',
        startedAt: '2026-11-13T10:00:00.000Z',
        finishedAt: expect.any(String),
      },
    ]);
  });

  it('returns null for tools that never ran', async () => {
    expect(await repo.get('whois')).toBeNull();
  });
});
