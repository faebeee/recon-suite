import {
  apiFindings,
  dedupeSpecs,
  isDocPage,
  parseGraphql,
  parseSpec,
} from './api-discovery.parser.js';

const OAS3 = JSON.stringify({
  openapi: '3.0.1',
  info: { title: 'Shop API', version: '2.1' },
  servers: [{ url: 'https://api.x.test/v2' }],
  paths: {
    '/orders': {
      get: { summary: 'List orders' },
      post: { operationId: 'createOrder' },
      parameters: [],
    },
    '/admin/users/{id}': { delete: {} },
  },
  components: { securitySchemes: { bearer: { type: 'http' } } },
});

describe('parseSpec', () => {
  it('reads an OpenAPI 3 JSON spec', () => {
    expect(parseSpec('https://x.test/openapi.json', OAS3)).toEqual({
      url: 'https://x.test/openapi.json',
      format: 'json',
      version: 'OpenAPI 3.0.1',
      title: 'Shop API',
      apiVersion: '2.1',
      servers: ['https://api.x.test/v2'],
      operations: 3,
      endpoints: [
        { method: 'GET', path: '/orders', summary: 'List orders' },
        { method: 'POST', path: '/orders', summary: 'createOrder' },
        { method: 'DELETE', path: '/admin/users/{id}' },
      ],
      hasSecuritySchemes: true,
    });
  });

  it('reads Swagger 2 host/basePath and missing auth', () => {
    const s = parseSpec(
      'u',
      JSON.stringify({
        swagger: '2.0',
        host: 'x.test',
        basePath: '/api',
        paths: {},
      }),
    );
    expect(s).toMatchObject({
      version: 'Swagger 2.0',
      servers: ['x.test/api'],
      hasSecuritySchemes: false,
    });
  });

  it('reads the usual YAML layout', () => {
    const yaml = [
      'openapi: "3.1.0"',
      'info:',
      '  title: Pets',
      '  version: 1.0.0',
      'paths:',
      '  /pets:',
      '    get:',
      '      summary: List',
      '    post:',
      '      summary: Add',
      '  "/pets/{id}":',
      '    parameters: []',
      '    delete:',
      'components:',
      '  securitySchemes:',
      '    key: {}',
    ].join('\n');
    expect(parseSpec('u', yaml)).toMatchObject({
      format: 'yaml',
      version: 'OpenAPI 3.1.0',
      title: 'Pets',
      apiVersion: '1.0.0',
      operations: 3,
      endpoints: [
        { method: 'GET', path: '/pets' },
        { method: 'POST', path: '/pets' },
        { method: 'DELETE', path: '/pets/{id}' },
      ],
      hasSecuritySchemes: true,
    });
  });

  it('rejects anything else', () => {
    expect(parseSpec('u', '<!doctype html><title>Home</title>')).toBeNull();
    expect(parseSpec('u', '{"status":"ok"}')).toBeNull();
    expect(parseSpec('u', '{broken')).toBeNull();
  });
});

describe('isDocPage', () => {
  it('needs the documentation markup', () => {
    expect(isDocPage('swagger-ui', '<div id="swagger-ui"></div>')).toBe(true);
    expect(isDocPage('swagger-ui', '<h1>Docs</h1>')).toBe(false);
    expect(isDocPage('redoc', '<redoc spec-url="/openapi.json">')).toBe(true);
  });
});

describe('parseGraphql', () => {
  it('reads an introspection answer', () => {
    const body = JSON.stringify({
      data: {
        __schema: {
          queryType: { fields: [{ name: 'me' }, { name: 'orders' }] },
          mutationType: { fields: [{ name: 'deleteUser' }] },
          types: [{ name: 'A' }, { name: 'B' }],
        },
      },
    });
    expect(parseGraphql('u', body)).toEqual({
      url: 'u',
      introspection: true,
      queries: ['me', 'orders'],
      mutations: ['deleteUser'],
      types: 2,
    });
  });

  it('recognises a GraphQL endpoint that refuses introspection', () => {
    expect(
      parseGraphql('u', '{"errors":[{"message":"introspection is disabled"}]}'),
    ).toEqual({ url: 'u', introspection: false, queries: [], mutations: [] });
  });

  it('ignores non-GraphQL answers', () => {
    expect(parseGraphql('u', '{"error":"not found"}')).toBeNull();
    expect(parseGraphql('u', 'Not Found')).toBeNull();
  });
});

describe('dedupeSpecs and apiFindings', () => {
  it('counts a spec served twice once and grades auth', () => {
    const a = parseSpec('https://x.test/openapi.json', OAS3)!;
    const b = parseSpec('https://x.test/v3/api-docs', OAS3)!;
    const specs = dedupeSpecs([a, b]);
    expect(specs).toHaveLength(1);
    const f = apiFindings({
      specs: [{ ...a, hasSecuritySchemes: false }],
      docPages: ['https://x.test/docs'],
      graphql: [
        {
          url: 'https://x.test/graphql',
          introspection: true,
          queries: [],
          mutations: [],
        },
      ],
    });
    expect(f.map((x) => x.status)).toEqual(['warn', 'info', 'warn']);
  });

  it('reports when nothing is found', () => {
    expect(apiFindings({ specs: [], docPages: [], graphql: [] })[0]?.id).toBe(
      'api.none',
    );
  });
});
