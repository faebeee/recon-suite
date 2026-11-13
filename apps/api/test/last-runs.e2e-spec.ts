import { Test } from '@nestjs/testing';
import { BadGatewayException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  ENGAGEMENT_HEADER,
  type Engagement,
  type LastToolRunResponse,
} from '@recon/shared';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { DnsService } from './../src/features/dns/dns.service.js';

/** Fake resolver: can be held open (to observe `running`) or made to fail. No network. */
let gate: Promise<void> | undefined;
let fail = false;
const fakeDns = {
  lookup: async () => {
    await gate;
    if (fail) throw new BadGatewayException('resolver exploded');
    return {
      resolver: 'cloudflare',
      servers: ['1.1.1.1'],
      records: [{ type: 'A', values: ['93.184.216.34'] }],
    };
  },
};

describe('Last runs (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  const last = async () =>
    (await http.get('/api/last-runs/dns').expect(200))
      .body as LastToolRunResponse;

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

  it('is empty before the first run and rejects unknown tools', async () => {
    expect(await last()).toEqual({ run: null });
    await http.get('/api/last-runs/not-a-tool').expect(400);
  });

  it('stores a run as running, then its result', async () => {
    let release!: () => void;
    gate = new Promise((r) => (release = r));
    const pending = http
      .post('/api/tools/dns')
      .send({ target: 'example.com' })
      .then((res) => res);

    await vi.waitFor(async () =>
      expect((await last()).run?.status).toBe('running'),
    );
    expect((await last()).run).toMatchObject({
      target: 'example.com',
      input: { target: 'example.com' },
    });

    release();
    gate = undefined;
    expect((await pending).status).toBe(200);
    const { run } = await last();
    expect(run).toMatchObject({ status: 'ok', target: 'example.com' });
    expect(run?.result?.data).toMatchObject({ resolver: 'cloudflare' });
    expect(run?.finishedAt).toBeDefined();
  });

  it('stores failures with status and message', async () => {
    fail = true;
    await http
      .post('/api/tools/dns')
      .send({ target: 'example.org' })
      .expect(502);
    fail = false;
    expect((await last()).run).toMatchObject({
      status: 'error',
      target: 'example.org',
      error: { status: 502, message: 'resolver exploded' },
    });
  });

  it('records engagement runs with their runId and scope rejections', async () => {
    const e = (
      await http.post('/api/engagements').send({ name: 'Last run' }).expect(201)
    ).body as Engagement;
    await http
      .post(`/api/engagements/${e.id}/scope`)
      .send({ entries: [{ value: 'example.com' }] })
      .expect(201);

    const ok = await http
      .post('/api/tools/dns')
      .set(ENGAGEMENT_HEADER, e.id)
      .send({ target: 'example.com' })
      .expect(200);
    const stored = (await last()).run;
    expect(stored?.engagementId).toBe(e.id);
    expect(stored?.result?.runId).toBe(ok.body.runId);

    // dns is passive, so use an active tool for the scope check.
    await http
      .post('/api/tools/ports')
      .set(ENGAGEMENT_HEADER, e.id)
      .send({ target: 'out-of-scope.test' })
      .expect(403);
    const ports = (await http.get('/api/last-runs/ports').expect(200))
      .body as LastToolRunResponse;
    expect(ports.run).toMatchObject({
      status: 'error',
      error: { status: 403 },
    });
  });
});
