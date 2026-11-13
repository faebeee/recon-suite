import {
  TLS_PROTOCOLS,
  type CipherStrength,
  type TlsAuditOutput,
  type TlsProtocolVersion,
} from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { FindingsList, GradePanel, PivotLinks } from '@/components/tool';
import type { Tone } from '@/lib/tones';

const LABEL: Record<TlsProtocolVersion, string> = {
  TLSv1: 'TLS 1.0',
  'TLSv1.1': 'TLS 1.1',
  'TLSv1.2': 'TLS 1.2',
  'TLSv1.3': 'TLS 1.3',
};

const STRENGTH_TONE: Record<CipherStrength, Tone> = {
  strong: 'green',
  acceptable: 'cyan',
  weak: 'yellow',
  insecure: 'magenta',
};

/** Enabled legacy protocols are bad, missing modern ones are a warning. */
function protocolTone(version: TlsProtocolVersion, supported: boolean): Tone {
  const legacy = version === 'TLSv1' || version === 'TLSv1.1';
  if (legacy) return supported ? 'magenta' : 'green';
  return supported ? 'green' : 'yellow';
}

function flag(value: boolean | null, yes: string, no: string) {
  if (value === null) return <Tag tone="muted">unknown</Tag>;
  return value ? <Tag tone="green">{yes}</Tag> : <Tag tone="yellow">{no}</Tag>;
}

export function TlsAuditResults({ data }: { data: TlsAuditOutput }) {
  const byProtocol = TLS_PROTOCOLS.map((version) => ({
    version,
    ciphers: data.ciphers.filter((c) => c.protocol === version),
  })).filter((g) => g.ciphers.length > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <GradePanel report={data.report} caption="TLS configuration" />

      <Panel title="Findings" bodyClassName="p-0">
        <FindingsList findings={data.report.findings} />
      </Panel>

      <Panel title="Protocols" bodyClassName="p-0">
        <ul className="divide-y divide-border text-sm">
          {data.protocols.map((p) => (
            <li key={p.version} className="space-y-1 px-4 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{LABEL[p.version]}</span>
                {p.error ? (
                  <Tag tone="muted">untested</Tag>
                ) : (
                  <Tag tone={protocolTone(p.version, p.supported)}>
                    {p.supported ? 'enabled' : 'disabled'}
                  </Tag>
                )}
              </div>
              {p.error && (
                <p className="text-xs break-words text-muted-foreground">
                  {p.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Handshake">
        <KeyValueGrid
          items={[
            {
              label: 'Endpoint',
              value: (
                <span className="inline-flex flex-wrap items-center gap-1">
                  <code>
                    {data.address}:{data.port}
                  </code>
                  <PivotLinks value={data.address} exclude="tls-audit" />
                </span>
              ),
            },
            { label: 'Key exchange', value: data.keyExchange },
            {
              label: 'OCSP stapling',
              value: flag(data.ocspStapling, 'stapled', 'not stapled'),
            },
            {
              label: 'Certificate transparency',
              value: flag(
                data.certificateTransparency,
                'embedded SCTs',
                'no embedded SCTs',
              ),
            },
          ]}
        />
      </Panel>

      <Panel
        title={`Cipher suites (${data.ciphers.length})`}
        className="lg:col-span-2"
        bodyClassName="p-0"
      >
        {byProtocol.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No cipher suites enumerated.
          </p>
        )}
        {byProtocol.map((g) => (
          <div key={g.version} className="border-b border-border last:border-0">
            <p className="bg-muted/40 px-4 py-1.5 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              {LABEL[g.version]} ({g.ciphers.length})
            </p>
            <ul className="divide-y divide-border text-sm">
              {g.ciphers.map((c) => (
                <li
                  key={c.name}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2"
                >
                  <Tag
                    tone={STRENGTH_TONE[c.strength]}
                    className="w-24 justify-center"
                  >
                    {c.strength}
                  </Tag>
                  <div className="min-w-0 flex-1">
                    <code className="block truncate" title={c.name}>
                      {c.name}
                    </code>
                    {c.standardName && c.standardName !== c.name && (
                      <code
                        className="block truncate text-xs text-muted-foreground"
                        title={c.standardName}
                      >
                        {c.standardName}
                      </code>
                    )}
                  </div>
                  {c.notes.length > 0 && (
                    <span className="flex flex-wrap gap-1">
                      {c.notes.map((n) => (
                        <Tag key={n} tone="muted">
                          {n}
                        </Tag>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Panel>
    </div>
  );
}
