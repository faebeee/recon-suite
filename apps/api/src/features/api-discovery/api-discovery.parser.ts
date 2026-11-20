import {
  MAX_SPEC_ENDPOINTS,
  type ApiDocKind,
  type ApiEndpoint,
  type ApiSpec,
  type Finding,
  type GraphqlEndpoint,
} from '@recon/shared';

export interface ProbePath {
  path: string;
  kind: ApiDocKind;
}

/** Fixed list of well-known locations (framework defaults). Not a wordlist brute force. */
export const PROBE_PATHS: ProbePath[] = [
  ...[
    '/openapi.json',
    '/openapi.yaml',
    '/swagger.json',
    '/swagger.yaml',
    '/v2/api-docs',
    '/v3/api-docs',
    '/api-docs',
    '/api-docs.json',
    '/api/openapi.json',
    '/api/swagger.json',
    '/api/v1/openapi.json',
    '/swagger/v1/swagger.json',
  ].map((path) => ({ path, kind: 'openapi' as const })),
  ...[
    '/swagger-ui.html',
    '/swagger-ui/',
    '/swagger/',
    '/docs',
    '/api/docs',
  ].map((path) => ({ path, kind: 'swagger-ui' as const })),
  { path: '/redoc', kind: 'redoc' },
  ...['/graphql', '/api/graphql', '/v1/graphql'].map((path) => ({
    path,
    kind: 'graphql' as const,
  })),
];

const METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'patch',
  'options',
  'head',
  'trace',
];

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** OpenAPI 3 / Swagger 2 document in JSON or YAML; null when the body is neither. */
export function parseSpec(url: string, body: string): ApiSpec | null {
  const trimmed = body.trimStart();
  if (trimmed.startsWith('{')) {
    try {
      const json: unknown = JSON.parse(trimmed);
      return isRec(json) ? parseJsonSpec(url, json) : null;
    } catch {
      return null;
    }
  }
  return parseYamlSpec(url, body);
}

function parseJsonSpec(url: string, json: Rec): ApiSpec | null {
  const oas = str(json.openapi);
  const swagger = str(json.swagger);
  if (!oas && !swagger) return null;
  const info = isRec(json.info) ? json.info : {};
  const servers = oas
    ? (Array.isArray(json.servers) ? json.servers : [])
        .filter(isRec)
        .map((s) => str(s.url))
        .filter((s): s is string => !!s)
    : [`${str(json.host) ?? ''}${str(json.basePath) ?? ''}`].filter(Boolean);
  const endpoints: ApiEndpoint[] = [];
  let operations = 0;
  for (const [path, item] of Object.entries(
    isRec(json.paths) ? json.paths : {},
  )) {
    if (!isRec(item)) continue;
    for (const method of METHODS) {
      const op = item[method];
      if (!isRec(op)) continue;
      operations++;
      if (endpoints.length < MAX_SPEC_ENDPOINTS) {
        const summary = str(op.summary) ?? str(op.operationId);
        endpoints.push({
          method: method.toUpperCase(),
          path,
          ...(summary && { summary: summary.slice(0, 200) }),
        });
      }
    }
  }
  const components = isRec(json.components) ? json.components : {};
  const schemes = oas ? components.securitySchemes : json.securityDefinitions;
  const title = str(info.title);
  const apiVersion = str(info.version);
  return {
    url,
    format: 'json',
    version: oas ? `OpenAPI ${oas}` : `Swagger ${swagger}`,
    ...(title && { title }),
    ...(apiVersion && { apiVersion }),
    servers,
    operations,
    endpoints,
    hasSecuritySchemes: isRec(schemes) && Object.keys(schemes).length > 0,
  };
}

/**
 * Line-based reading of a YAML spec (no YAML parser): the version, info title/version and
 * `paths` entries in the usual two-space layout that generators write.
 */
function parseYamlSpec(url: string, body: string): ApiSpec | null {
  const head = /^(openapi|swagger)\s*:\s*["']?([\w.]+)/m.exec(body);
  if (!head) return null;
  const lines = body.split(/\r?\n/);
  const endpoints: ApiEndpoint[] = [];
  let operations = 0;
  let section = '';
  let path: string | undefined;
  let title: string | undefined;
  let apiVersion: string | undefined;
  let hasSecuritySchemes = false;
  for (const line of lines) {
    const top = /^([A-Za-z]\w*)\s*:/.exec(line);
    if (top) {
      section = top[1] ?? '';
      path = undefined;
      continue;
    }
    if (section === 'info') {
      const m = /^ {2}(title|version)\s*:\s*["']?(.*?)["']?\s*$/.exec(line);
      if (m?.[1] === 'title') title = m[2];
      if (m?.[1] === 'version') apiVersion = m[2];
    } else if (section === 'paths') {
      const p = /^ {2}["']?(\/[^"':]*)["']?\s*:/.exec(line);
      if (p) {
        path = p[1];
        continue;
      }
      const op = /^ {4}(\w+)\s*:/.exec(line);
      if (path && op && METHODS.includes(op[1] ?? '')) {
        operations++;
        if (endpoints.length < MAX_SPEC_ENDPOINTS) {
          endpoints.push({ method: (op[1] ?? '').toUpperCase(), path });
        }
      }
    } else if (section === 'securityDefinitions' && /^ {2}\S/.test(line)) {
      hasSecuritySchemes = true;
    } else if (
      section === 'components' &&
      /^ {2}securitySchemes\s*:/.test(line)
    ) {
      hasSecuritySchemes = true;
    }
  }
  return {
    url,
    format: 'yaml',
    version: `${head[1] === 'openapi' ? 'OpenAPI' : 'Swagger'} ${head[2]}`,
    ...(title && { title }),
    ...(apiVersion && { apiVersion }),
    servers: [],
    operations,
    endpoints,
    hasSecuritySchemes,
  };
}

/** Swagger UI, ReDoc or GraphiQL page (verified by its markup, not the status code). */
export function isDocPage(kind: ApiDocKind, body: string): boolean {
  if (kind === 'swagger-ui') return /swagger-ui/i.test(body);
  if (kind === 'redoc') return /<redoc\b|redoc\.standalone/i.test(body);
  return false;
}

/** Read-only introspection: names of the query and mutation fields. */
export const INTROSPECTION_QUERY = JSON.stringify({
  query:
    'query ReconIntrospection { __schema { queryType { fields { name } } mutationType { fields { name } } types { name } } }',
});

/** GraphQL answer to the introspection query; null when the body is not GraphQL at all. */
export function parseGraphql(
  url: string,
  body: string,
): GraphqlEndpoint | null {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRec(json) || (!('data' in json) && !Array.isArray(json.errors)))
    return null;
  const data = isRec(json.data) ? json.data : {};
  const schema = isRec(data.__schema) ? data.__schema : undefined;
  if (!schema) {
    return { url, introspection: false, queries: [], mutations: [] };
  }
  const fields = (t: unknown) =>
    (isRec(t) && Array.isArray(t.fields) ? t.fields : [])
      .filter(isRec)
      .map((f) => str(f.name))
      .filter((n): n is string => !!n)
      .slice(0, 200);
  return {
    url,
    introspection: true,
    queries: fields(schema.queryType),
    mutations: fields(schema.mutationType),
    ...(Array.isArray(schema.types) && { types: schema.types.length }),
  };
}

/** Specs found at several paths (e.g. /openapi.json and /v3/api-docs) count once. */
export function dedupeSpecs(specs: ApiSpec[]): ApiSpec[] {
  const seen = new Set<string>();
  return specs.filter((s) => {
    const key = `${s.version}|${s.title ?? ''}|${s.apiVersion ?? ''}|${s.operations}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function apiFindings(o: {
  specs: ApiSpec[];
  docPages: string[];
  graphql: GraphqlEndpoint[];
}): Finding[] {
  const out: Finding[] = [];
  for (const s of o.specs) {
    out.push({
      id: `api.spec.${new URL(s.url).pathname}`,
      status: s.hasSecuritySchemes ? 'info' : 'warn',
      title: `Public API spec: ${s.title ?? s.version}`,
      message: s.hasSecuritySchemes
        ? `${s.version} with ${s.operations} operations is readable without login. Check that it lists nothing internal.`
        : `${s.version} with ${s.operations} operations is readable without login and declares no authentication scheme: check whether the endpoints really need none.`,
      value: s.url,
    });
  }
  for (const page of o.docPages) {
    out.push({
      id: `api.docs.${new URL(page).pathname}`,
      status: 'info',
      title: 'Interactive API documentation',
      message:
        'An API console is public; it lets anyone try requests from the browser.',
      value: page,
    });
  }
  for (const g of o.graphql) {
    out.push(
      g.introspection
        ? {
            id: `api.graphql.${new URL(g.url).pathname}`,
            status: 'warn',
            title: 'GraphQL introspection enabled',
            message: `Anyone can download the full schema (${g.queries.length} queries, ${g.mutations.length} mutations). Disable introspection in production.`,
            value: g.url,
          }
        : {
            id: `api.graphql.${new URL(g.url).pathname}`,
            status: 'pass',
            title: 'GraphQL introspection disabled',
            message:
              'The endpoint answers GraphQL but refuses the introspection query.',
            value: g.url,
          },
    );
  }
  if (!out.length) {
    out.push({
      id: 'api.none',
      status: 'info',
      title: 'No API description found',
      message:
        'None of the well-known spec, documentation or GraphQL locations answered.',
    });
  }
  return out;
}
