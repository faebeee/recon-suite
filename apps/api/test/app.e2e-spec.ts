import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { TOOL_IDS, type RuntimeInfo } from '@recon/shared';
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

  it('rejects invalid input with 400', () =>
    request(app.getHttpServer())
      .post('/api/tools/dns')
      .send({ target: 'not a domain' })
      .expect(400));

  it('blocks private targets with 403', () =>
    request(app.getHttpServer())
      .post('/api/tools/ports')
      .send({ target: '127.0.0.1', ports: [22] })
      .expect(403));
});
