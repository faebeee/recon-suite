import {
  MAX_CHANGE_ITEMS,
  type ChangeItem,
  type ToolResult,
} from '@recon/shared';

/**
 * Change monitoring: reduces a tool output to named facets of key -> value (e.g. "Open
 * ports": "443/tcp" -> "nginx 1.25"), so two runs can be compared by meaning instead of
 * by JSON path. Every tool gets its findings and grade; inventory-style tools also get
 * their lists (subdomains, records, ports, hosts, ...). Stored results are untrusted JSON
 * from older versions too, so every field is narrowed before use.
 */
export type Snapshot = Map<string, Map<string, string>>;

type Rec = Record<string, unknown>;
type Add = (facet: string, key: string | undefined, value?: unknown) => void;

const isRec = (v: unknown): v is Rec =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const recs = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const str = (v: unknown): string | undefined =>
  typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : undefined;
/** Joins the present parts with spaces; false/null/undefined (from `cond && x`) are skipped. */
const words = (...parts: unknown[]) =>
  parts
    .filter((p) => p !== false && p !== null && p !== undefined)
    .map(str)
    .filter((p): p is string => !!p)
    .join(' ');

/**
 * Response headers that change on every request (caches, tracing, dates) and would make
 * every HTTP run look different.
 */
const VOLATILE_HEADER =
  /^(date|age|expires|last-modified|etag|set-cookie|content-length|via|server-timing|report-to|nel|cf-ray|cf-cache-status|x-cache.*|x-served-by|x-timer|x-request-id|x-amz-.*|x-azure-ref|x-fastly-request-id|x-runtime|x-trace-id|traceparent|x-correlation-id|x-varnish)$/i;

const EXTRACTORS: Partial<Record<string, (d: Rec, add: Add) => void>> = {
  subdomains: (d, add) => {
    for (const s of recs(d.subdomains)) add('Subdomains', str(s.name));
  },
  'cert-search': (d, add) => {
    for (const s of recs(d.domains)) add('Domains', str(s.name));
  },
  dns: (d, add) => {
    for (const set of recs(d.records)) {
      for (const v of strs(set.values)) add('Records', words(set.type, v));
    }
  },
  ports: (d, add) => {
    for (const p of recs(d.results)) {
      if (p.state === 'open') add('Open ports', str(p.port), p.service);
    }
  },
  nmap: (d, add) => {
    for (const p of recs(d.ports)) {
      if (p.state !== 'open') continue;
      add(
        'Open ports',
        `${str(p.port)}/${str(p.protocol) ?? 'tcp'}`,
        words(p.service, p.product, p.version) || undefined,
      );
    }
  },
  'banner-grab': (d, add) => {
    for (const p of recs(d.results)) {
      if (p.state !== 'banner' && p.state !== 'silent') continue;
      add('Services', str(p.port), words(p.service, p.product, p.version));
    }
  },
  'network-scan': (d, add) => hosts(d, add),
  'host-scan': (d, add) => hosts(d, add),
  tls: (d, add) => {
    const cert = isRec(d.certificate) ? d.certificate : {};
    add('Certificate', 'Fingerprint (SHA-256)', cert.fingerprint256);
    add('Certificate', 'Subject', cert.subject);
    add('Certificate', 'Issuer', cert.issuer);
    add('Certificate', 'Valid until', cert.validTo);
    add('Certificate', 'Trusted', d.authorized);
    for (const san of strs(cert.subjectAltNames)) add('Names (SAN)', san);
    add('Handshake', 'Protocol', d.protocol);
    add('Handshake', 'Cipher', isRec(d.cipher) ? d.cipher.name : undefined);
  },
  'tech-fingerprint': (d, add) => {
    for (const t of recs(d.technologies)) {
      add('Technologies', str(t.name), t.version ?? '');
    }
  },
  'passive-exposure': (d, add) => {
    for (const a of recs(d.addresses)) {
      for (const p of Array.isArray(a.ports) ? a.ports : []) {
        add('Exposed ports', `${str(a.ip)}:${str(p)}`);
      }
      for (const v of strs(a.vulns))
        add('Vulnerabilities', `${str(a.ip)} ${v}`);
    }
  },
  'ip-intel': (d, add) => {
    for (const a of recs(d.addresses)) {
      const asn = isRec(a.asn) ? a.asn : {};
      const provider = isRec(a.provider) ? a.provider : {};
      add(
        'Addresses',
        str(a.ip),
        words(asn.number && `AS${str(asn.number)}`, asn.name, provider.name),
      );
    }
  },
  'reverse-ip': (d, add) => {
    for (const domain of strs(d.domains)) add('Co-hosted domains', domain);
  },
  whois: (d, add) => {
    add('Registration', 'Registrar', d.registrar);
    for (const e of recs(d.events)) {
      if (e.action === 'expiration') add('Registration', 'Expires', e.date);
    }
    for (const ns of strs(d.nameservers)) add('Nameservers', ns.toLowerCase());
    for (const s of strs(d.status)) add('Status', s);
  },
  'js-endpoints': (d, add) => {
    for (const e of recs(d.endpoints)) add('Endpoints', str(e.value));
    for (const h of strs(d.hosts)) add('Hosts', h);
    for (const s of recs(d.secrets)) add('Secrets', words(s.type, s.masked));
  },
  takeover: (d, add) => {
    for (const c of recs(d.candidates)) {
      add('Candidates', str(c.host), words(c.status, strs(c.cname).join(',')));
    }
  },
  'cloud-storage': (d, add) => {
    for (const b of recs(d.results)) {
      if (b.state === 'public-list' || b.state === 'exists-private') {
        add('Buckets', words(b.provider, b.name), b.state);
      }
    }
  },
  'http-headers': (d, add) => {
    add('Response', 'Final URL', d.finalUrl);
    add('Response', 'Status', d.status);
    const headers = isRec(d.headers) ? d.headers : {};
    for (const [name, value] of Object.entries(headers)) {
      if (!VOLATILE_HEADER.test(name)) add('Headers', name, value);
    }
  },
  'cookie-audit': (d, add) => {
    for (const c of recs(d.cookies)) {
      add(
        'Cookies',
        str(c.name),
        words(
          c.secure === true && 'Secure',
          c.httpOnly === true && 'HttpOnly',
          c.sameSite && `SameSite=${str(c.sameSite)}`,
          c.domain && `Domain=${str(c.domain)}`,
        ),
      );
    }
  },
  'http-methods': (d, add) => {
    const options = isRec(d.options) ? d.options : {};
    for (const m of strs(options.allowed)) add('Allowed methods', m);
  },
};

function hosts(d: Rec, add: Add) {
  for (const h of recs(d.hosts)) {
    add('Hosts', str(h.ip), words(h.macAddress, h.vendor));
  }
}

/** Letter grade and score, wherever the tool keeps them. */
function grade(d: Rec): string | undefined {
  for (const holder of [d, d.report, d.security]) {
    if (isRec(holder) && typeof holder.grade === 'string') {
      return words(
        holder.grade,
        typeof holder.score === 'number' && `(${holder.score})`,
      );
    }
  }
  return undefined;
}

export function snapshot(
  tool: string,
  result: ToolResult<unknown> | undefined,
): Snapshot {
  const snap: Snapshot = new Map();
  const add: Add = (facet, key, value) => {
    if (!key) return;
    let entries = snap.get(facet);
    if (!entries) snap.set(facet, (entries = new Map()));
    entries.set(key, str(value) ?? '');
  };
  if (!result) return snap;

  // Findings: keyed by title (made unique with the id), valued by status.
  const titles = new Set<string>();
  for (const f of recs(result.findings)) {
    const title = str(f.title) ?? str(f.id);
    if (!title) continue;
    const key = titles.has(title) ? `${title} (${str(f.id)})` : title;
    titles.add(title);
    add('Findings', key, f.status);
  }

  const data = isRec(result.data) ? result.data : {};
  add('Grade', grade(data) && 'Grade', grade(data));
  EXTRACTORS[tool]?.(data, add);
  return snap;
}

/** Facet by facet: keys only in `after` are added, only in `before` removed. */
export function compareSnapshots(
  before: Snapshot,
  after: Snapshot,
): { items: ChangeItem[]; truncated: boolean } {
  const items: ChangeItem[] = [];
  const facets = new Set([...before.keys(), ...after.keys()]);
  for (const facet of facets) {
    const a = before.get(facet) ?? new Map<string, string>();
    const b = after.get(facet) ?? new Map<string, string>();
    for (const [key, value] of b) {
      const old = a.get(key);
      if (old === undefined) {
        items.push({
          facet,
          key,
          kind: 'added',
          ...(value && { after: value }),
        });
      } else if (old !== value) {
        items.push({ facet, key, kind: 'changed', before: old, after: value });
      }
    }
    for (const [key, value] of a) {
      if (!b.has(key)) {
        items.push({
          facet,
          key,
          kind: 'removed',
          ...(value && { before: value }),
        });
      }
    }
  }
  return {
    items: items.slice(0, MAX_CHANGE_ITEMS),
    truncated: items.length > MAX_CHANGE_ITEMS,
  };
}

/** Same request options? Key order does not matter. */
export function sameInput(a: unknown, b: unknown): boolean {
  return stableJson(a) === stableJson(b);
}

function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (isRec(v)) {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}
