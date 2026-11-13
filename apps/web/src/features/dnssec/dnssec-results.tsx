import type { DnssecOutput, DnssecStatus, RrsigRecord } from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { FindingsList } from '@/components/tool';
import { cn } from '@/lib/utils';
import { toneText, type Tone } from '@/lib/tones';

const STATUS: Record<DnssecStatus, { tone: Tone; caption: string }> = {
  secure: { tone: 'green', caption: 'Chain of trust validates' },
  insecure: { tone: 'yellow', caption: 'No DS record at the parent: unsigned' },
  bogus: { tone: 'magenta', caption: 'Signed, but validation fails' },
  indeterminate: { tone: 'muted', caption: 'Could not determine the status' },
};

const th = 'py-1.5 pr-4 font-normal';
const headRow =
  'text-left text-[10px] tracking-[0.2em] text-muted-foreground uppercase';

function sigTone(s: RrsigRecord): Tone {
  if (s.daysRemaining < 0) return 'magenta';
  if (s.daysRemaining < 7) return 'yellow';
  return 'green';
}

export function DnssecResults({ data }: { data: DnssecOutput }) {
  const st = STATUS[data.status];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel
        title="Status"
        tone={st.tone}
        bodyClassName="flex flex-col items-center gap-3 py-6 text-center"
      >
        <span
          className={cn(
            'font-dot text-4xl font-black uppercase text-glow sm:text-5xl',
            toneText[st.tone],
          )}
        >
          {data.status}
        </span>
        <p className="text-xs text-muted-foreground">{st.caption}</p>
      </Panel>

      <Panel title="Overview" className="lg:col-span-2">
        <KeyValueGrid
          items={[
            { label: 'Domain', value: data.domain },
            { label: 'Resolver', value: data.resolver },
            { label: 'DS records', value: data.ds.length },
            { label: 'DNSKEYs', value: data.dnskeys.length },
            {
              label: 'Denial of existence',
              value: data.denial ? <Tag>{data.denial}</Tag> : undefined,
            },
            { label: 'Signatures seen', value: data.signatures.length },
          ]}
        />
      </Panel>

      <Panel title="DS (parent)" className="lg:col-span-3" bodyClassName="p-0">
        {data.ds.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No DS records
          </p>
        ) : (
          <div className="overflow-x-auto px-4 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className={headRow}>
                  <th className={th}>Key tag</th>
                  <th className={th}>Algorithm</th>
                  <th className={th}>Digest type</th>
                  <th className="py-1.5 font-normal">Digest</th>
                </tr>
              </thead>
              <tbody>
                {data.ds.map((d, i) => (
                  <tr key={i} className="border-t border-border/50 align-top">
                    <td className="py-1.5 pr-4 tabular-nums">{d.keyTag}</td>
                    <td className="py-1.5 pr-4">
                      {d.algorithmName}{' '}
                      <span className="text-muted-foreground">
                        ({d.algorithm})
                      </span>
                    </td>
                    <td
                      className={cn(
                        'py-1.5 pr-4',
                        d.digestType === 1 && toneText.yellow,
                      )}
                    >
                      {d.digestType === 1
                        ? 'SHA-1'
                        : d.digestType === 2
                          ? 'SHA-256'
                          : d.digestType === 4
                            ? 'SHA-384'
                            : d.digestType}
                    </td>
                    <td className="py-1.5">
                      <code className="break-all text-muted-foreground">
                        {d.digest}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="DNSKEY" className="lg:col-span-3" bodyClassName="p-0">
        {data.dnskeys.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No DNSKEY records
          </p>
        ) : (
          <div className="overflow-x-auto px-4 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className={headRow}>
                  <th className={th}>Role</th>
                  <th className={th}>Flags</th>
                  <th className={th}>Algorithm</th>
                  <th className="py-1.5 font-normal">Key size</th>
                </tr>
              </thead>
              <tbody>
                {data.dnskeys.map((k, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="py-1.5 pr-4">
                      <Tag tone={k.role === 'KSK' ? 'cyan' : 'muted'}>
                        {k.role}
                      </Tag>
                    </td>
                    <td className="py-1.5 pr-4 tabular-nums">{k.flags}</td>
                    <td className="py-1.5 pr-4">
                      {k.algorithmName}{' '}
                      <span className="text-muted-foreground">
                        ({k.algorithm})
                      </span>
                    </td>
                    <td className="py-1.5 tabular-nums">
                      {k.keyBits ? `${k.keyBits} bits` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="RRSIG" className="lg:col-span-3" bodyClassName="p-0">
        {data.signatures.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No signatures seen
          </p>
        ) : (
          <div className="overflow-x-auto px-4 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className={headRow}>
                  <th className={th}>Covers</th>
                  <th className={th}>Algorithm</th>
                  <th className={th}>Signer</th>
                  <th className={th}>Inception</th>
                  <th className={th}>Expiration</th>
                  <th className="py-1.5 font-normal">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {data.signatures.map((s, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="py-1.5 pr-4">
                      <Tag>{s.typeCovered}</Tag>
                    </td>
                    <td className="py-1.5 pr-4 tabular-nums">{s.algorithm}</td>
                    <td className="py-1.5 pr-4 break-all">{s.signer}</td>
                    <td className="py-1.5 pr-4 whitespace-nowrap text-muted-foreground">
                      {fmtDate(s.inception)}
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap">
                      {fmtDate(s.expiration)}
                    </td>
                    <td
                      className={cn(
                        'py-1.5 whitespace-nowrap tabular-nums',
                        toneText[sigTone(s)],
                      )}
                    >
                      {s.daysRemaining < 0
                        ? `expired ${Math.abs(s.daysRemaining)} d ago`
                        : `${s.daysRemaining} d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Findings" className="lg:col-span-3" bodyClassName="p-0">
        <FindingsList findings={data.findings} />
      </Panel>
    </div>
  );
}

function fmtDate(iso: string): string {
  return iso.replace('T', ' ').replace(/:\d{2}\.\d{3}Z$/, ' UTC');
}
