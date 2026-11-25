import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  ENGAGEMENT_HEADER,
  type Engagement,
  type PostureSeries,
  type RunChanges,
  type RunPage,
  type ToolId,
} from '@recon/shared';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DnsService } from './../src/features/dns/dns.service.js';
import { EngagementsRepository } from './../src/features/engagements/engagements.repository.js';

/** DNS answers change between runs so the diff has something to show. No network. */
let answer = ['93.184.216.34'];
let failNext = false;
const fakeDns = {
  lookup: async () => {
    if (failNext) {
      failNext = false;
      throw new (await import('@nestjs/common')).BadGatewayException(
        'resolver exploded',
      );
    }
    return {
      resolver: 'cloudflare',
      servers: ['1.1.1.1'],
      records: [{ type: 'A', values: answer }],
    };
  },
};

describe('Engagements (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DnsService)
      .useValue(fakeDns)
      .compile();
    app = configureApp(
      moduleRef.createNestApplication(),
    ) as INestApplication<App>;
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(() => app.close());

  it('runs the whole engagement flow', async () => {
    // Create.
    const created = await http
      .post('/api/engagements')
      .send({ name: 'ACME Q4', client: 'ACME' })
      .expect(201);
    const e = created.body as Engagement;
    expect(e.counts.runs).toBe(0);

    // There is no scope: the scope endpoints are gone.
    await http.get(`/api/engagements/${e.id}/scope`).expect(404);

    // Tool runs are recorded and get a runId.
    const first = await http
      .post('/api/tools/dns')
      .set(ENGAGEMENT_HEADER, e.id)
      .send({ target: 'example.com' })
      .expect(200);
    expect(first.body.runId).toEqual(expect.any(String));
    answer = ['93.184.216.34', '93.184.216.35'];
    const second = await http
      .post('/api/tools/dns')
      .set(ENGAGEMENT_HEADER, e.id)
      .send({ target: 'example.com' })
      .expect(200);

    // Upstream failures are recorded as error runs and still reach the client.
    failNext = true;
    await http
      .post('/api/tools/dns')
      .set(ENGAGEMENT_HEADER, e.id)
      .send({ target: 'example.com' })
      .expect(502);

    // Without the header nothing is stored.
    await http
      .post('/api/tools/dns')
      .send({ target: 'example.com' })
      .expect(200);

    const page = (await http.get(`/api/engagements/${e.id}/runs`).expect(200))
      .body as RunPage;
    expect(page.total).toBe(3);
    expect(page.items[0]).toMatchObject({
      status: 'error',
      error: { status: 502, message: 'resolver exploded' },
    });
    expect(page.items[1]!.id).toBe(second.body.runId);

    const detail = await http.get(`/api/runs/${first.body.runId}`).expect(200);
    expect(detail.body.result.data.records[0].values).toEqual([
      '93.184.216.34',
    ]);

    const diff = await http
      .get(`/api/runs/${first.body.runId}/diff/${second.body.runId}`)
      .expect(200);
    expect(diff.body.entries).toEqual([
      { path: 'records[0].values', kind: 'added', after: '93.184.216.35' },
    ]);

    // Change monitoring: the second run against the first, in meaningful terms.
    const changes = (
      await http.get(`/api/runs/${second.body.runId}/changes`).expect(200)
    ).body as RunChanges;
    expect(changes.before?.id).toBe(first.body.runId);
    expect(changes.inputChanged).toBe(false);
    expect(changes.items).toEqual([
      { facet: 'Records', key: 'A 93.184.216.35', kind: 'added' },
    ]);
    expect(changes.rawDifferences).toBe(1);
    const firstChanges = (
      await http.get(`/api/runs/${first.body.runId}/changes`).expect(200)
    ).body as RunChanges;
    expect(firstChanges.before).toBeNull();
    const feed = (
      await http.get(`/api/engagements/${e.id}/changes`).expect(200)
    ).body as RunChanges[];
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({
      tool: 'dns',
      target: 'example.com',
      after: { id: second.body.runId },
      input: { target: 'example.com' },
    });

    const tagged = await http
      .patch(`/api/runs/${second.body.runId}`)
      .send({ tags: ['Baseline', 'baseline', 'dns'] })
      .expect(200);
    expect(tagged.body.tags).toEqual(['baseline', 'dns']);
    const byTag = (
      await http.get(`/api/engagements/${e.id}/runs?tag=dns`).expect(200)
    ).body as RunPage;
    expect(byTag.total).toBe(1);

    // Notes.
    const note = await http
      .post(`/api/engagements/${e.id}/notes`)
      .send({
        title: 'Kickoff',
        body: 'Scope confirmed by IT',
        tags: ['meeting'],
      })
      .expect(201);
    await http
      .patch(`/api/notes/${note.body.id}`)
      .send({ title: 'Kickoff call' })
      .expect(200);

    // Notes import (all or nothing, import order kept).
    const imported = await http
      .post(`/api/engagements/${e.id}/notes/import`)
      .send({
        format: 'recon-suite/notes',
        version: 1,
        notes: [
          { title: 'Imported A', target: 'example.com', tags: ['Scanner'] },
          { title: 'Imported B', body: 'second' },
        ],
      })
      .expect(201);
    expect(imported.body.map((n: { title: string }) => n.title)).toEqual([
      'Imported A',
      'Imported B',
    ]);
    expect(imported.body[0].tags).toEqual(['scanner']);
    await http
      .post(`/api/engagements/${e.id}/notes/import`)
      .send({
        format: 'recon-suite/notes',
        version: 1,
        notes: [{ title: 'ok' }, { body: 'missing title' }],
      })
      .expect(400);
    const allNotes = (
      await http.get(`/api/engagements/${e.id}/notes`).expect(200)
    ).body as { title: string }[];
    expect(allNotes.map((n) => n.title)).toEqual([
      'Imported A',
      'Imported B',
      'Kickoff call',
    ]);

    // Export.
    const md = await http
      .get(`/api/engagements/${e.id}/export?format=md`)
      .expect(200);
    expect(md.headers['content-disposition']).toMatch(
      /acme-q4-\d{4}-\d{2}-\d{2}\.md/,
    );
    expect(md.text).toContain('# ACME Q4');
    expect(md.text).toContain('### Kickoff call');
    const csv = await http
      .get(`/api/engagements/${e.id}/export?format=csv`)
      .expect(200);
    expect(csv.text.split('\r\n')[0]).toContain('status,');

    // Archived engagements refuse new runs.
    await http
      .patch(`/api/engagements/${e.id}`)
      .send({ status: 'archived' })
      .expect(200);
    await http
      .post('/api/tools/dns')
      .set(ENGAGEMENT_HEADER, e.id)
      .send({ target: 'example.com' })
      .expect(409);

    // Unknown engagement.
    await http
      .post('/api/tools/dns')
      .set(ENGAGEMENT_HEADER, '00000000-0000-4000-8000-000000000000')
      .send({ target: 'example.com' })
      .expect(404);

    // Delete cascades.
    await http.delete(`/api/engagements/${e.id}`).expect(204);
    await http.get(`/api/runs/${first.body.runId}`).expect(404);
  });

  it('tracks grade and status history per tool and target', async () => {
    const e = (
      await http.post('/api/engagements').send({ name: 'Posture' }).expect(201)
    ).body as Engagement;
    const repo = app.get(EngagementsRepository);
    const store = (
      tool: ToolId,
      target: string,
      startedAt: string,
      data: unknown,
    ) =>
      repo.insertRun({
        engagementId: e.id,
        tool,
        target,
        startedAt,
        durationMs: 5,
        input: { target },
        result: { tool, target, startedAt, durationMs: 5, data },
      });
    const site = 'https://example.com/';
    const r1 = await store('http-headers', site, '2026-11-01T10:00:00.000Z', {
      security: { grade: 'D', score: 45 },
    });
    const r2 = await store('http-headers', site, '2026-11-03T10:00:00.000Z', {
      security: { grade: 'A', score: 90 },
    });
    await store('tls-audit', 'example.com', '2026-11-02T10:00:00.000Z', {
      report: { grade: 'B', score: 74 },
    });
    await store('dnssec', 'example.com', '2026-11-02T10:00:00.000Z', {
      status: 'insecure',
    });
    await store('email-security', 'example.com', '2026-11-02T10:00:00.000Z', {
      report: { grade: 'C', score: 60 },
    });
    // Not tracked: other tools and failed runs.
    await store('dns', 'example.com', '2026-11-02T10:00:00.000Z', {});
    await repo.insertRun({
      engagementId: e.id,
      tool: 'dnssec',
      target: 'example.com',
      startedAt: '2026-11-04T10:00:00.000Z',
      durationMs: 5,
      input: {},
      error: { status: 502, message: 'resolver down' },
    });

    const series = (
      await http.get(`/api/engagements/${e.id}/posture`).expect(200)
    ).body as PostureSeries[];
    expect(series).toEqual([
      {
        tool: 'http-headers',
        target: site,
        points: [
          {
            runId: r1,
            observedAt: '2026-11-01T10:00:00.000Z',
            value: 'D',
            score: 45,
          },
          {
            runId: r2,
            observedAt: '2026-11-03T10:00:00.000Z',
            value: 'A',
            score: 90,
          },
        ],
      },
      {
        tool: 'tls-audit',
        target: 'example.com',
        points: [expect.objectContaining({ value: 'B', score: 74 })],
      },
      {
        tool: 'dnssec',
        target: 'example.com',
        points: [expect.objectContaining({ value: 'insecure' })],
      },
      {
        tool: 'email-security',
        target: 'example.com',
        points: [expect.objectContaining({ value: 'C', score: 60 })],
      },
    ]);
    expect(series[2]?.points[0]).not.toHaveProperty('score');

    await http
      .get('/api/engagements/00000000-0000-4000-8000-000000000000/posture')
      .expect(404);
    await http.delete(`/api/engagements/${e.id}`).expect(204);
  });
});
