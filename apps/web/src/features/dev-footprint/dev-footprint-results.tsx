import {
  Archive,
  Container,
  Download,
  ExternalLink,
  GitBranch,
  GitFork,
  Package,
  Star,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  FOOTPRINT_PLATFORM_LABELS,
  type DevFootprintOutput,
  type FootprintAccount,
  type FootprintItem,
  type FootprintNamesake,
  type FootprintPlatform,
  type FootprintPlatformResult,
} from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import { formatDate } from '@/lib/format';
import type { Tone } from '@/lib/tones';

const ICON: Record<FootprintPlatform, LucideIcon> = {
  github: GitBranch,
  gitlab: GitBranch,
  npm: Package,
  pypi: Package,
  dockerhub: Container,
};

const STATUS: Record<
  FootprintPlatformResult['status'],
  { tone: Tone; label: string }
> = {
  found: { tone: 'green', label: 'found' },
  'not-found': { tone: 'muted', label: 'not found' },
  error: { tone: 'yellow', label: 'lookup failed' },
};

const compact = new Intl.NumberFormat('en', { notation: 'compact' });

export function DevFootprintResults({ data }: { data: DevFootprintOutput }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Looked up the handle{' '}
        <code className="text-foreground">{data.handle}</code>
        {data.domain && <> (derived from {data.domain})</>}. Organisations often
        use other names on some platforms; search again with that handle if
        something is missing.
      </p>
      <Panel title="Findings" bodyClassName="p-0">
        <FindingsList findings={data.findings} />
      </Panel>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {data.platforms.map((p) => (
          <PlatformPanel key={p.platform} p={p} handle={data.handle} />
        ))}
      </div>
    </div>
  );
}

function ExtLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={
        className ??
        'inline-flex min-w-0 items-center gap-1 text-primary underline-offset-4 hover:underline'
      }
    >
      {children}
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </a>
  );
}

function PlatformPanel({
  p,
  handle,
}: {
  p: FootprintPlatformResult;
  handle: string;
}) {
  const label = FOOTPRINT_PLATFORM_LABELS[p.platform];
  const Icon = ICON[p.platform];
  const st = STATUS[p.status];
  const showNamesake = p.platform === 'npm' || p.platform === 'pypi';

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <Icon className="size-3.5" aria-hidden />
          {label}
        </span>
      }
      tone={p.status === 'error' ? 'yellow' : 'cyan'}
      bodyClassName="p-0"
      actions={<Tag tone={st.tone}>{st.label}</Tag>}
    >
      <div className="space-y-4 p-4">
        {p.error && <p className="text-xs text-neon-yellow">! {p.error}</p>}
        {p.account && <AccountBlock a={p.account} label={label} />}
        {!p.account && p.status === 'not-found' && p.platform !== 'pypi' && (
          <p className="text-sm text-muted-foreground">
            {p.platform === 'npm'
              ? `The @${handle} scope is unclaimed: no npm organisation owns it.`
              : `No ${label} ${p.platform === 'dockerhub' ? 'namespace' : 'organisation'} named "${handle}".`}
          </p>
        )}
        {showNamesake && p.namesake !== undefined && (
          <NamesakeBlock n={p.namesake} label={label} handle={handle} />
        )}
      </div>
      {p.items.length > 0 && (
        <ItemList items={p.items} heading={itemHeading(p, handle)} />
      )}
    </Panel>
  );
}

function AccountBlock({ a, label }: { a: FootprintAccount; label: string }) {
  if (a.kind === 'user') {
    return (
      <p className="text-sm text-muted-foreground">
        This handle is a personal {label} account, not an organisation. It is
        not inspected further. <ExtLink href={a.url}>Open</ExtLink>
      </p>
    );
  }
  return (
    <KeyValueGrid
      className="sm:grid-cols-2"
      items={[
        {
          label: a.kind === 'scope' ? 'Scope' : 'Account',
          value: (
            <ExtLink href={a.url}>
              <span className="truncate">{a.name ?? a.url}</span>
            </ExtLink>
          ),
        },
        ...(a.verified !== undefined
          ? [
              {
                label: 'Verified domain',
                value: (
                  <Tag tone={a.verified ? 'green' : 'muted'}>
                    {a.verified ? 'yes' : 'no'}
                  </Tag>
                ),
              },
            ]
          : []),
        ...(a.website
          ? [
              {
                label: 'Website',
                value: (
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="break-all">{a.website}</span>
                    <PivotLinks value={a.website} exclude="dev-footprint" />
                  </span>
                ),
              },
            ]
          : []),
        ...(a.location ? [{ label: 'Location', value: a.location }] : []),
        ...(a.createdAt
          ? [{ label: 'Created', value: formatDate(a.createdAt) }]
          : []),
        ...(a.description
          ? [{ label: 'Description', value: a.description }]
          : []),
      ]}
    />
  );
}

function NamesakeBlock({
  n,
  label,
  handle,
}: {
  n: FootprintNamesake | null;
  label: string;
  handle: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        Package named “{handle}”
      </p>
      {n === null ? (
        <p className="text-sm text-muted-foreground">
          Unregistered on {label}.
        </p>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <ExtLink href={n.url}>{n.name}</ExtLink>
            {n.version && (
              <span className="text-xs text-muted-foreground">
                v{n.version}
              </span>
            )}
            <Tag tone={n.ownedByOrg || n.linkedToOrg ? 'green' : 'yellow'}>
              {n.ownedByOrg
                ? 'owned by org'
                : n.linkedToOrg
                  ? 'linked to org'
                  : 'not linked to org'}
            </Tag>
          </p>
          {n.description && (
            <p className="text-xs text-muted-foreground">{n.description}</p>
          )}
          {n.links.length > 0 && (
            <ul className="space-y-0.5 text-xs">
              {n.links.map((l) => (
                <li key={l} className="break-all">
                  <ExtLink href={l}>{l}</ExtLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function itemHeading(p: FootprintPlatformResult, handle: string) {
  const n = p.items.length;
  if (p.platform === 'npm') {
    return `${n} most recent @${handle}/ packages${
      p.totalItems ? ` · the org owns ${p.totalItems} in total` : ''
    }`;
  }
  const noun = p.platform === 'dockerhub' ? 'images' : 'repositories';
  return p.totalItems && p.totalItems > n
    ? `${n} most recently updated of ${p.totalItems} ${noun}`
    : `${n} ${noun}`;
}

function ItemList({
  items,
  heading,
}: {
  items: FootprintItem[];
  heading: string;
}) {
  return (
    <div className="border-t border-border">
      <p className="px-4 pt-3 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        {heading}
      </p>
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <li key={i.url} className="space-y-1 px-4 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <ExtLink href={i.url}>
                <span className="break-all">{i.name}</span>
              </ExtLink>
              {i.version && (
                <span className="text-xs text-muted-foreground">
                  v{i.version}
                </span>
              )}
              {i.archived && (
                <Tag tone="muted">
                  <Archive className="size-3" aria-hidden />
                  archived
                </Tag>
              )}
              {i.fork && (
                <Tag tone="muted">
                  <GitFork className="size-3" aria-hidden />
                  fork
                </Tag>
              )}
              {i.language && <Tag tone="muted">{i.language}</Tag>}
            </div>
            {i.description && (
              <p className="text-xs text-muted-foreground">{i.description}</p>
            )}
            <p className="flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
              {i.updatedAt && <span>updated {formatDate(i.updatedAt)}</span>}
              {i.stars !== undefined && i.stars > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3" aria-hidden />
                  {compact.format(i.stars)}
                </span>
              )}
              {i.pulls !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Download className="size-3" aria-hidden />
                  {compact.format(i.pulls)} pulls
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
