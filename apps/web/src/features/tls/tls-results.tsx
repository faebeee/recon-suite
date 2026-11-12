import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { CertificateInfo, TlsOutput } from '@recon/shared';
import { KeyValueGrid, Meter, Panel, Tag } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toneText, type Tone } from '@/lib/tones';

function expiryTone(days: number): Tone {
  if (days < 7) return 'magenta';
  if (days < 30) return 'yellow';
  return 'green';
}

function commonName(dn: string): string {
  return /CN=([^,]+)/.exec(dn)?.[1] ?? dn;
}

export function TlsResults({ data }: { data: TlsOutput }) {
  const cert = data.certificate;
  const tone = expiryTone(cert.daysRemaining);
  const lifetime = Math.max(
    1,
    (Date.parse(cert.validTo) - Date.parse(cert.validFrom)) / 86_400_000,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Handshake" tone={data.authorized ? 'green' : 'magenta'}>
        <div className="mb-4 flex items-center gap-3">
          {data.authorized ? (
            <ShieldCheck className="size-8 text-neon-green" />
          ) : (
            <ShieldAlert className="size-8 text-neon-magenta" />
          )}
          <div>
            <p
              className={cn(
                'font-display text-sm tracking-[0.2em] uppercase',
                data.authorized ? 'text-neon-green' : 'text-neon-magenta',
              )}
            >
              {data.authorized ? 'Trusted chain' : 'Untrusted'}
            </p>
            {data.authorizationError && (
              <p className="text-xs text-muted-foreground">
                {data.authorizationError}
              </p>
            )}
          </div>
        </div>
        <KeyValueGrid
          items={[
            { label: 'Endpoint', value: `${data.address}:${data.port}` },
            {
              label: 'Protocol',
              value: (
                <Tag tone={data.protocol === 'TLSv1.3' ? 'green' : 'yellow'}>
                  {data.protocol ?? '?'}
                </Tag>
              ),
            },
            {
              label: 'Cipher',
              value: data.cipher.standardName ?? data.cipher.name,
            },
            {
              label: 'Key',
              value: cert.keyBits ? `${cert.keyBits} bit` : undefined,
            },
          ]}
        />
      </Panel>

      <Panel title="Validity" tone={tone}>
        <p
          className={cn(
            'font-display text-4xl font-black text-glow',
            toneText[tone],
          )}
        >
          {cert.daysRemaining}
          <span className="ml-2 text-sm font-normal tracking-[0.2em] text-muted-foreground uppercase">
            days left
          </span>
        </p>
        <div className="my-4">
          <Meter value={(cert.daysRemaining / lifetime) * 100} tone={tone} />
        </div>
        <KeyValueGrid
          items={[
            { label: 'Not before', value: formatDate(cert.validFrom) },
            { label: 'Not after', value: formatDate(cert.validTo) },
          ]}
        />
      </Panel>

      <Panel title="Certificate" className="lg:col-span-2">
        <CertificateDetails cert={cert} />
        <div className="mt-4 space-y-2">
          <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Subject alt names ({cert.subjectAltNames.length})
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {cert.subjectAltNames.map((san) => (
              <li key={san} className="flex items-center gap-1">
                <code>{san}</code>
                {!san.startsWith('*') && (
                  <PivotLinks value={san} exclude="tls" />
                )}
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      {data.chain.length > 0 && (
        <Panel title="Chain" className="lg:col-span-2" bodyClassName="p-0">
          <ol className="divide-y divide-border">
            {data.chain.map((c, i) => (
              <li
                key={c.fingerprint256}
                className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm"
              >
                <Tag tone="muted">#{i + 1}</Tag>
                <span>{commonName(c.subject)}</span>
                {c.selfSigned && <Tag tone="cyan">root</Tag>}
                <span className="ml-auto text-xs text-muted-foreground">
                  until {formatDate(c.validTo)}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}

function CertificateDetails({ cert }: { cert: CertificateInfo }) {
  return (
    <KeyValueGrid
      items={[
        { label: 'Subject', value: cert.subject },
        { label: 'Issuer', value: cert.issuer },
        {
          label: 'Serial',
          value: <code className="text-xs break-all">{cert.serialNumber}</code>,
        },
        {
          label: 'SHA-256',
          value: (
            <code className="text-xs break-all">{cert.fingerprint256}</code>
          ),
        },
      ]}
    />
  );
}
