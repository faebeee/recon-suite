import {
  TECH_CATEGORIES,
  type TechCategory,
  type TechFingerprintOutput,
} from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';

const CATEGORY_LABEL: Record<TechCategory, string> = {
  server: 'Web server',
  language: 'Language / runtime',
  framework: 'Framework',
  cms: 'CMS / site builder',
  ecommerce: 'E-commerce',
  cdn: 'CDN / edge',
  hosting: 'Hosting',
  'js-library': 'JavaScript libraries',
  analytics: 'Analytics',
  security: 'Security',
};

export function TechFingerprintResults({
  data,
}: {
  data: TechFingerprintOutput;
}) {
  const groups = TECH_CATEGORIES.map((cat) => ({
    cat,
    items: data.technologies.filter((t) => t.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <Panel title="Page">
        <KeyValueGrid
          className="lg:grid-cols-4"
          items={[
            {
              label: 'Final URL',
              value: (
                <span className="flex items-center gap-1">
                  <code className="truncate">{data.finalUrl}</code>
                  <PivotLinks
                    value={data.finalUrl}
                    exclude="tech-fingerprint"
                  />
                </span>
              ),
            },
            { label: 'Status', value: data.status },
            { label: 'Redirects', value: data.redirects },
            { label: 'Title', value: data.title },
          ]}
        />
        {data.truncated && (
          <p className="mt-3 text-xs text-neon-yellow">
            Page larger than 1 MB: only the first 1 MB of HTML was analysed.
          </p>
        )}
      </Panel>

      {groups.length === 0 && (
        <Panel title="Technologies">
          <p className="text-sm text-muted-foreground">
            No known technology matched. The site may hide its stack, or render
            everything client-side from an unknown bundle.
          </p>
        </Panel>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map(({ cat, items }) => (
          <Panel key={cat} title={CATEGORY_LABEL[cat]} bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {items.map((t) => (
                <li key={t.name} className="space-y-1 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{t.name}</span>
                    {t.version && <Tag tone="cyan">v{t.version}</Tag>}
                    <Tag tone={t.confidence === 'high' ? 'green' : 'muted'}>
                      {t.confidence}
                    </Tag>
                  </div>
                  <ul className="space-y-0.5">
                    {t.evidence.map((e) => (
                      <li
                        key={e}
                        className="truncate text-xs text-muted-foreground"
                        title={e}
                      >
                        {e}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}
