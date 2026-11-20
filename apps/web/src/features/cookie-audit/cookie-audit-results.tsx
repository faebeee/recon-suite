import type {
  AuditedCookie,
  CookieAuditOutput,
  CookieCheckId,
} from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { FindingsList, GradePanel, PivotLinks } from '@/components/tool';
import { formatDuration } from '@/lib/format';
import { FINDING_TONE, toneText } from '@/lib/tones';

const COLUMNS: { id: CookieCheckId; label: string }[] = [
  { id: 'secure', label: 'Secure' },
  { id: 'httponly', label: 'HttpOnly' },
  { id: 'samesite', label: 'SameSite' },
  { id: 'prefix', label: 'Prefix' },
  { id: 'domain', label: 'Domain' },
  { id: 'lifetime', label: 'Lifetime' },
];

/** Short cell text: the attribute value as set, the check status gives the colour. */
function cellText(c: AuditedCookie, id: CookieCheckId): string {
  switch (id) {
    case 'secure':
      return c.secure ? 'yes' : 'no';
    case 'httponly':
      return c.httpOnly ? 'yes' : 'no';
    case 'samesite':
      return c.sameSite ?? 'unset';
    case 'prefix':
      return c.prefix ?? 'none';
    case 'domain':
      return c.domain ?? 'host-only';
    case 'lifetime':
      return c.maxAgeSeconds === undefined
        ? 'session'
        : c.maxAgeSeconds <= 0
          ? 'expired'
          : formatDuration(c.maxAgeSeconds);
  }
}

function CookieRow({ c }: { c: AuditedCookie }) {
  const problems = c.checks.filter(
    (x) => x.status === 'fail' || x.status === 'warn',
  );
  return (
    <>
      <tr className="border-t border-border/50 align-top">
        <td className="py-2 pr-4">
          <p className="font-semibold break-all">{c.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {c.valueLength} chars{c.path && ` · path ${c.path}`}
          </p>
          {c.sensitive && (
            <Tag tone="cyan" className="mt-1">
              session-like
            </Tag>
          )}
        </td>
        {COLUMNS.map(({ id }) => {
          const check = c.checks.find((x) => x.id === id);
          return (
            <td key={id} className="py-2 pr-4" title={check?.message}>
              <Tag tone={check ? FINDING_TONE[check.status] : 'muted'}>
                {cellText(c, id)}
              </Tag>
            </td>
          );
        })}
      </tr>
      {problems.length > 0 && (
        <tr>
          <td
            colSpan={COLUMNS.length + 1}
            className="pb-2 text-xs text-muted-foreground"
          >
            <ul className="space-y-0.5">
              {problems.map((p) => (
                <li key={p.id}>
                  <span className={toneText[FINDING_TONE[p.status]]}>
                    {p.status}
                  </span>{' '}
                  {p.message}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

export function CookieAuditResults({ data }: { data: CookieAuditOutput }) {
  const issues = data.findings.filter(
    (f) => f.status === 'fail' || f.status === 'warn',
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        {data.grade !== null && data.score !== null ? (
          <GradePanel
            report={{
              grade: data.grade,
              score: data.score,
              findings: data.findings,
            }}
            caption={`${data.cookies.length} cookie${data.cookies.length === 1 ? '' : 's'}`}
          />
        ) : (
          <Panel title="Grade">
            <p className="text-sm text-muted-foreground">
              No cookies to grade.
            </p>
          </Panel>
        )}
        <Panel title="Issues" bodyClassName="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
            <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Final URL
            </span>
            <code className="min-w-0 flex-1 truncate" title={data.finalUrl}>
              {data.finalUrl}
            </code>
            <PivotLinks value={data.finalUrl} exclude="cookie-audit" />
          </div>
          {data.cookies.length ? (
            issues.length ? (
              <FindingsList findings={issues} />
            ) : (
              <p className="px-4 py-3 text-sm text-neon-green">
                Every cookie is set with sensible attributes.
              </p>
            )
          ) : (
            <FindingsList findings={data.findings} />
          )}
        </Panel>
      </div>

      {data.cookies.length > 0 && (
        <Panel title="Cookies" bodyClassName="p-0">
          <div className="overflow-x-auto px-4 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  <th className="py-1 pr-4 font-normal">Cookie</th>
                  {COLUMNS.map((c) => (
                    <th key={c.id} className="py-1 pr-4 font-normal">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.cookies.map((c) => (
                  <CookieRow
                    key={`${c.name}|${c.domain ?? ''}|${c.path ?? ''}`}
                    c={c}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {data.truncated && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              More cookies were set; only the first {data.cookies.length} are
              audited.
            </p>
          )}
        </Panel>
      )}

      <Panel title="Redirect chain" bodyClassName="p-0">
        <ol className="divide-y divide-border text-xs">
          {data.hops.map((h, i) => (
            <li
              key={`${i}-${h.url}`}
              className="flex flex-wrap items-center gap-3 px-4 py-2"
            >
              <Tag
                tone={
                  h.status < 300 ? 'green' : h.status < 400 ? 'cyan' : 'magenta'
                }
              >
                {h.status}
              </Tag>
              <code className="min-w-0 flex-1 break-all">{h.url}</code>
              <span className="text-muted-foreground">
                {h.cookies} Set-Cookie
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
