import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('reports ok status', () => {
    expect(new HealthController().check()).toMatchObject({
      status: 'ok',
      service: 'api',
    });
  });
});
