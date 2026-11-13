import type {
  IpIntelAddress,
  IpIntelOutput,
  ProviderKind,
} from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';
import type { Tone } from '@/lib/tones';

const PROVIDER_TONE: Record<ProviderKind, Tone> = {
  cdn: 'cyan',
  cloud: 'yellow',
  hosting: 'green',
};

export function IpIntelResults({ data }: { data: IpIntelOutput }) {
  return (
    <div className="space-y-4">
      {data.kind === 'domain' && (
        <p className="text-xs text-muted-foreground">
          {data.query} resolves to {data.resolvedCount} address
          {data.resolvedCount === 1 ? '' : 'es'}
          {data.resolvedCount > data.addresses.length &&
            `; showing the first ${data.addresses.length}`}
          .
        </p>
      )}
      {data.addresses.map((a) => (
        <AddressPanel key={a.ip} a={a} />
      ))}
    </div>
  );
}

function AddressPanel({ a }: { a: IpIntelAddress }) {
  return (
    <Panel
      title={a.ip}
      code={`IPv${a.version}`}
      actions={
        <>
          {a.provider && (
            <Tag tone={PROVIDER_TONE[a.provider.kind]}>
              {a.provider.kind}: {a.provider.name}
            </Tag>
          )}
          <PivotLinks value={a.ip} exclude="ip-intel" />
        </>
      }
    >
      <div className="space-y-4">
        <KeyValueGrid
          className="lg:grid-cols-4"
          items={[
            {
              label: 'Reverse DNS',
              value: a.ptr.length ? (
                <ul>
                  {a.ptr.map((p) => (
                    <li key={p} className="flex items-center gap-1">
                      <code className="truncate">{p}</code>
                      <PivotLinks value={p} exclude="ip-intel" />
                    </li>
                  ))}
                </ul>
              ) : undefined,
            },
            {
              label: 'Forward confirmed',
              value:
                a.forwardConfirmed === null ? undefined : (
                  <Tag tone={a.forwardConfirmed ? 'green' : 'yellow'}>
                    {a.forwardConfirmed ? 'yes' : 'no'}
                  </Tag>
                ),
            },
            {
              label: 'ASN',
              value: a.asn && (
                <span>
                  AS{a.asn.number}
                  {a.asn.name && (
                    <span className="block text-xs text-muted-foreground">
                      {a.asn.name}
                    </span>
                  )}
                </span>
              ),
            },
            { label: 'BGP prefix', value: a.asn?.prefix },
            { label: 'Network', value: a.network?.name },
            { label: 'Organisation', value: a.network?.organisation },
            { label: 'Range', value: a.network?.cidr.join(', ') },
            {
              label: 'Country / RIR',
              value:
                [
                  a.network?.country ?? a.asn?.country,
                  a.asn?.registry?.toUpperCase(),
                ]
                  .filter(Boolean)
                  .join(' / ') || undefined,
            },
          ]}
        />
        {a.errors.length > 0 && (
          <ul className="space-y-0.5 text-xs text-neon-yellow">
            {a.errors.map((e) => (
              <li key={e}>! {e}</li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
