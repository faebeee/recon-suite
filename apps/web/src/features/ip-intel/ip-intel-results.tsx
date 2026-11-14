import type {
  IpIntelAddress,
  IpIntelOutput,
  ProviderKind,
} from '@recon/shared';
import { KeyValueGrid, Panel, Tag, WorldMap } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';
import { countryName, normalizeCountryCode } from '@/lib/countries';
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
      <CountryMapPanel addresses={data.addresses} />
      {data.addresses.map((a) => (
        <AddressPanel key={a.ip} a={a} />
      ))}
    </div>
  );
}

/** Registry country of an address (RDAP network first, then the ASN record). */
function addressCountry(a: IpIntelAddress) {
  return normalizeCountryCode(a.network?.country ?? a.asn?.country);
}

function CountryMapPanel({ addresses }: { addresses: IpIntelAddress[] }) {
  const byCountry = new Map<string, string[]>();
  for (const a of addresses) {
    const code = addressCountry(a);
    if (code) byCountry.set(code, [...(byCountry.get(code) ?? []), a.ip]);
  }
  if (byCountry.size === 0) return null;

  const codes = [...byCountry.keys()];
  const names = codes.map(countryName);
  return (
    <Panel
      title="Registry country"
      code="GEO"
      actions={codes.map((c) => (
        <Tag key={c}>{c}</Tag>
      ))}
      bodyClassName="p-0"
    >
      <WorldMap
        highlight={codes}
        label={`World map highlighting ${names.join(', ')}`}
      />
      <ul className="flex flex-wrap gap-x-6 gap-y-1 border-t border-inherit px-4 py-2 text-xs">
        {codes.map((code, i) => (
          <li key={code}>
            <span className="text-neon-cyan">{names[i]}</span>
            <span className="text-muted-foreground">
              {' '}
              · {byCountry.get(code)?.join(', ')}
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-inherit px-4 py-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        Country registered for the network (RDAP / ASN), not a precise
        geolocation
      </p>
    </Panel>
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
                  addressCountry(a) ?? a.network?.country ?? a.asn?.country,
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
