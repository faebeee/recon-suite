import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { RuntimeLocation } from '@recon/shared';
import { Panel, StatusDot } from '@/components/cyber';
import { runtimeSummary } from '@/components/tool';
import { getTool } from '@/features/registry';
import { LOCATION_META, STATUS_TONE, runtimeQuery } from '@/lib/runtime';
import { cn } from '@/lib/utils';
import { toneBorder, toneText } from '@/lib/tones';

const LOCATIONS: RuntimeLocation[] = ['host', 'container'];

/** Overview: which tools run on the API host or in the API container. */
export function RuntimePanel() {
  const { data } = useQuery(runtimeQuery);
  if (!data) return null;

  const groups = LOCATIONS.map((location) => ({
    location,
    tools: data.tools.filter((t) => t.location === location),
  })).filter((g) => g.tools.length > 0);

  return (
    <Panel
      title="Runtime"
      actions={
        <span className="text-[11px] tracking-wider text-muted-foreground uppercase">
          api: {LOCATION_META[data.api.location].label} ({data.api.platform})
        </span>
      }
    >
      <div
        className={cn(
          'grid gap-4',
          groups.length > 1 && 'md:grid-cols-2',
          groups.length > 2 && 'lg:grid-cols-3',
        )}
      >
        {groups.map(({ location, tools }) => {
          const meta = LOCATION_META[location];
          const Icon = meta.icon;
          return (
            <section
              key={location}
              className={cn('space-y-2 border-l-2 pl-3', toneBorder[meta.tone])}
            >
              <h3
                className={cn(
                  'flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] uppercase',
                  toneText[meta.tone],
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {meta.label}
                <span className="text-muted-foreground">({tools.length})</span>
              </h3>
              <ul className="space-y-1">
                {tools.map((t) => {
                  const tool = getTool(t.id);
                  return (
                    <li key={t.id} title={runtimeSummary(t)}>
                      <Link
                        to={tool.path}
                        className="flex items-baseline gap-2 text-xs hover:text-primary"
                      >
                        {t.status !== 'ok' && (
                          <span
                            className="self-center"
                            aria-label={`Status: ${t.status}`}
                          >
                            <StatusDot tone={STATUS_TONE[t.status]} />
                          </span>
                        )}
                        <span className="shrink-0 font-semibold">
                          {tool.name}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {t.engine}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </Panel>
  );
}
