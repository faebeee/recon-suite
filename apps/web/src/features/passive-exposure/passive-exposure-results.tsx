import { Link } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';
import {
  productQuerySchema,
  type ExposureAddress,
  type PassiveExposureOutput,
} from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import { getTool } from '@/features/registry';

const MAX_HOSTNAMES = 20;

/** "cpe:/a:nginx:nginx:1.18.0" (or CPE 2.3) -> { label: "nginx 1.18.0" }. */
export function describeCpe(cpe: string) {
  const parts = cpe.replace(/^cpe:2\.3:/, 'cpe:/').split(':');
  const product = parts[3]?.replace(/_/g, ' ');
  const version = parts[4] && parts[4] !== '*' ? parts[4] : undefined;
  if (!product) return { label: cpe, query: undefined };
  const label = version ? `${product} ${version}` : product;
  // Only versioned products make a useful CVE query.
  const query =
    version && productQuerySchema.safeParse(label).success ? label : undefined;
  return { label, query };
}

export function PassiveExposureResults({
  data,
}: {
  data: PassiveExposureOutput;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {data.kind === 'domain' && (
          <>
            {data.query} resolves to {data.resolvedCount} address
            {data.resolvedCount === 1 ? '' : 'es'}
            {data.resolvedCount > data.addresses.length &&
              `; showing the first ${data.addresses.length}`}
            .{' '}
          </>
        )}
        Data from {data.source}: what Shodan last saw, possibly days or weeks
        old. The target was not contacted.
      </p>
      <Panel title="Findings" bodyClassName="p-0">
        <FindingsList findings={data.findings} />
      </Panel>
      {data.addresses.map((a) => (
        <AddressPanel key={a.ip} a={a} />
      ))}
    </div>
  );
}

function AddressPanel({ a }: { a: ExposureAddress }) {
  const cve = getTool('cve-lookup');
  const risky = new Map(a.risky.map((r) => [r.port, r.service]));

  return (
    <Panel
      title={a.ip}
      tone={a.error ? 'yellow' : a.risky.length ? 'magenta' : 'cyan'}
      actions={
        <>
          {a.error ? (
            <Tag tone="yellow">lookup failed</Tag>
          ) : (
            <Tag tone={a.indexed ? 'cyan' : 'muted'}>
              {a.indexed ? `${a.ports.length} ports` : 'not indexed'}
            </Tag>
          )}
          <PivotLinks value={a.ip} exclude="passive-exposure" />
        </>
      }
    >
      {a.error ? (
        <p className="text-xs text-neon-yellow">! {a.error}</p>
      ) : !a.indexed ? (
        <p className="text-sm text-muted-foreground">
          Shodan has no open ports on record for this address. That does not
          prove nothing is exposed; run Port Probe for a live check.
        </p>
      ) : (
        <KeyValueGrid
          className="lg:grid-cols-2"
          items={[
            {
              label: 'Open ports',
              value: a.ports.length ? (
                <span className="flex flex-wrap gap-1">
                  {a.ports.map((p) => {
                    const service = risky.get(p);
                    return (
                      <Tag
                        key={p}
                        tone={service ? 'magenta' : 'cyan'}
                        className="normal-case"
                      >
                        <span title={service}>
                          {p}
                          {service && ` · ${service}`}
                        </span>
                      </Tag>
                    );
                  })}
                </span>
              ) : undefined,
            },
            {
              label: 'Known CVEs (unverified)',
              value: a.vulns.length ? (
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {a.vulns.map((v) => (
                    <a
                      key={v}
                      href={`https://nvd.nist.gov/vuln/detail/${v}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-neon-yellow underline-offset-4 hover:underline"
                    >
                      {v}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ))}
                </span>
              ) : undefined,
            },
            {
              label: 'Products',
              value: a.cpes.length ? (
                <ul className="space-y-0.5">
                  {a.cpes.map((c) => {
                    const { label, query } = describeCpe(c);
                    return (
                      <li key={c} className="flex items-center gap-2">
                        <span title={c}>{label}</span>
                        {query && (
                          <Link
                            to={cve.path}
                            search={{ target: query }}
                            className="text-[10px] tracking-[0.15em] text-primary uppercase underline-offset-4 hover:underline"
                            aria-label={`Look up CVEs for ${label}`}
                          >
                            CVEs
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : undefined,
            },
            {
              label: 'Tags',
              value: a.tags.length ? (
                <span className="flex flex-wrap gap-1">
                  {a.tags.map((t) => (
                    <Tag key={t} tone="muted">
                      {t}
                    </Tag>
                  ))}
                </span>
              ) : undefined,
            },
          ]}
        />
      )}
      {a.indexed && a.hostnames.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-border pt-3">
          <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Hostnames ({a.hostnames.length})
          </p>
          <ul className="space-y-1">
            {a.hostnames.slice(0, MAX_HOSTNAMES).map((h) => (
              <li
                key={h}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
              >
                <code className="text-sm break-all">{h}</code>
                <PivotLinks value={h} exclude="passive-exposure" />
              </li>
            ))}
          </ul>
          {a.hostnames.length > MAX_HOSTNAMES && (
            <p className="text-xs text-muted-foreground">
              +{a.hostnames.length - MAX_HOSTNAMES} more in the raw JSON
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
