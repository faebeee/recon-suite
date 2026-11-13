import type { EmailSecurityOutput } from '@recon/shared';
import { KeyValueGrid, Meter, Panel, Tag } from '@/components/cyber';
import { FindingsList, GradePanel, PivotLinks } from '@/components/tool';
import { cn } from '@/lib/utils';
import { toneText, type Tone } from '@/lib/tones';

function lookupTone(n: number): Tone {
  if (n > 10) return 'magenta';
  if (n >= 9) return 'yellow';
  return 'green';
}

function policyTone(p: string | undefined): Tone {
  if (p === 'reject' || p === 'quarantine') return 'green';
  if (p === 'none') return 'yellow';
  return 'magenta';
}

function bitsTone(bits: number | undefined, type: string | undefined): Tone {
  if (type !== 'rsa' || bits === undefined) return 'cyan';
  if (bits < 1024) return 'magenta';
  if (bits < 2048) return 'yellow';
  return 'green';
}

const mxHost = (mx: string) => mx.split(' ')[1]?.replace(/\.$/, '') ?? '';

export function EmailSecurityResults({ data }: { data: EmailSecurityOutput }) {
  const { spf, dmarc, dkim } = data;
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <GradePanel report={data.report} caption="mail authentication" />

      <Panel title="Findings" bodyClassName="p-0">
        <FindingsList findings={data.report.findings} />
      </Panel>

      <Panel title="SPF" className="lg:col-span-2">
        {spf.record ? (
          <div className="space-y-4">
            <code className="block text-xs break-all text-foreground/80">
              {spf.record}
            </code>
            <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
              <div className="space-y-1">
                <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  DNS lookups
                </p>
                <Meter
                  value={Math.min(spf.lookups, 10) * 10}
                  tone={lookupTone(spf.lookups)}
                  segments={10}
                />
                <p className={cn('text-xs', toneText[lookupTone(spf.lookups)])}>
                  {spf.lookups} of 10
                </p>
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  Includes ({spf.includes.length})
                </p>
                <ul className="space-y-0.5 text-sm">
                  {spf.includes.map((d) => (
                    <li
                      key={d}
                      className="flex items-center justify-between gap-2"
                    >
                      <code className="truncate">{d}</code>
                      <PivotLinks value={d} exclude="email-security" />
                    </li>
                  ))}
                  {spf.includes.length === 0 && (
                    <li className="text-muted-foreground">None</li>
                  )}
                </ul>
              </div>
            </div>
            {spf.errors.length > 0 && (
              <ul className="space-y-0.5 text-xs text-neon-yellow">
                {spf.errors.map((e) => (
                  <li key={e}>! {e}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No SPF record published.
          </p>
        )}
      </Panel>

      <Panel title="DMARC">
        {dmarc.record ? (
          <div className="space-y-3">
            <KeyValueGrid
              items={[
                {
                  label: 'Policy',
                  value: (
                    <Tag tone={policyTone(dmarc.policy)}>
                      {dmarc.policy ?? 'missing'}
                    </Tag>
                  ),
                },
                {
                  label: 'Subdomains',
                  value: dmarc.subdomainPolicy && (
                    <Tag tone={policyTone(dmarc.subdomainPolicy)}>
                      {dmarc.subdomainPolicy}
                    </Tag>
                  ),
                },
                { label: 'Coverage', value: `${dmarc.pct ?? 100}%` },
                { label: 'Found at', value: dmarc.name },
                { label: 'Aggregate (rua)', value: dmarc.rua.join(', ') },
                { label: 'Forensic (ruf)', value: dmarc.ruf.join(', ') },
              ]}
            />
            <code className="block text-xs break-all text-muted-foreground">
              {dmarc.record}
            </code>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No DMARC record found.
          </p>
        )}
      </Panel>

      <Panel title="DKIM" bodyClassName="p-0">
        <ul className="divide-y divide-border text-sm">
          {dkim.found.map((k) => (
            <li key={k.selector} className="flex items-center gap-2 px-4 py-2">
              <code className="min-w-0 flex-1 truncate">
                {k.selector}._domainkey
              </code>
              <Tag tone="muted">{k.keyType}</Tag>
              {k.revoked ? (
                <Tag tone="magenta">revoked</Tag>
              ) : (
                <Tag tone={bitsTone(k.keyBits, k.keyType)}>
                  {k.keyBits ? `${k.keyBits} bit` : 'unknown size'}
                </Tag>
              )}
            </li>
          ))}
          {dkim.found.length === 0 && (
            <li className="px-4 py-2 text-muted-foreground">No key found</li>
          )}
        </ul>
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {dkim.checked} selectors checked
        </p>
      </Panel>

      <Panel title="Mail servers & transport" className="lg:col-span-2">
        <div className="grid gap-4 md:grid-cols-2">
          <ul className="space-y-1 text-sm">
            {data.mx.map((mx) => (
              <li key={mx} className="flex items-center justify-between gap-2">
                <code className="truncate">{mx}</code>
                {mxHost(mx) && (
                  <PivotLinks value={mxHost(mx)} exclude="email-security" />
                )}
              </li>
            ))}
            {data.mx.length === 0 && (
              <li className="text-muted-foreground">No MX records</li>
            )}
          </ul>
          <KeyValueGrid
            className="sm:grid-cols-1"
            items={[
              { label: 'MTA-STS', value: data.mtaSts?.record },
              { label: 'TLS-RPT', value: data.tlsRpt?.record },
              { label: 'BIMI', value: data.bimi?.logo ?? data.bimi?.record },
            ]}
          />
        </div>
      </Panel>
    </div>
  );
}
