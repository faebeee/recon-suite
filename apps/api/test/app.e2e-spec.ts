import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { TOOL_IDS, type RuntimeInfo, type SystemOverview } from '@recon/shared';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(
      moduleFixture.createNestApplication(),
    ) as INestApplication<App>;
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health', () =>
    request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('ok')));

  it('GET /api/tools lists the catalog', () =>
    request(app.getHttpServer())
      .get('/api/tools')
      .expect(200)
      .expect((res) => expect(res.body.length).toBeGreaterThan(0)));

  it('GET /api/system/runtime describes where every tool runs', () =>
    request(app.getHttpServer())
      .get('/api/system/runtime')
      .expect(200)
      .expect((res) => {
        const body = res.body as RuntimeInfo;
        expect(body.tools.map((t) => t.id).sort()).toEqual(
          [...TOOL_IDS].sort(),
        );
        for (const t of body.tools) {
          expect(['host', 'container', 'kali']).toContain(t.location);
          expect(t.engine).toBeTruthy();
        }
      }));

  it('GET /api/system/overview reports settings and status checks', () =>
    request(app.getHttpServer())
      .get('/api/system/overview')
      .expect(200)
      .expect((res) => {
        const body = res.body as SystemOverview;
        expect(['ok', 'warn', 'error']).toContain(body.status);
        expect(body.checks.find((c) => c.id === 'database')?.status).toBe('ok');
        expect(body.database.path).toBe(':memory:');
        expect(body.tools.total).toBe(TOOL_IDS.length);
        for (const s of body.settings.filter((s) => s.secret)) {
          expect(s.value).toBeUndefined();
        }
      }));

  it('has no rate limit and no login', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 80; i++) {
      await request(server).get('/api/system/runtime').expect(200);
    }
    await request(server).get('/api/auth/status').expect(404);
  });

  it('rejects invalid input with 400', () =>
    request(app.getHttpServer())
      .post('/api/tools/dns')
      .send({ target: 'not a domain' })
      .expect(400));

  it('allows private targets', () =>
    request(app.getHttpServer())
      .post('/api/tools/ports')
      .send({ target: '127.0.0.1', ports: [1], timeoutMs: 500 })
      .expect(200));
});
