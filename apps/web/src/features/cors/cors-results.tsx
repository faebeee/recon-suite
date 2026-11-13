import type { CorsOutput, CorsTest, CorsTestId } from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import { FINDING_TONE } from '@/lib/tones';

const TEST_LABEL: Record<CorsTestId, string> = {
  baseline: 'Baseline',
  'arbitrary-origin': 'Arbitrary origin',
  'null-origin': 'null origin',
  'suffix-match': 'Suffix match',
  'prefix-match': 'Prefix match',
  'http-downgrade': 'HTTP downgrade',
  preflight: 'Preflight',
};

function TestRow({ t }: { t: CorsTest }) {
  return (
    <tr className="border-t border-border/50 align-top">
      <td className="py-2 pr-4">
        <p className="font-semibold whitespace-nowrap">{TEST_LABEL[t.id]}</p>
        <p className="text-[10px] text-muted-foreground">{t.method}</p>
      </td>
      <td className="max-w-56 py-2 pr-4 break-all text-muted-foreground">
        {t.origin ?? '(none)'}
      </td>
      <td className="py-2 pr-4 tabular-nums">{t.status ?? '-'}</td>
      <td className="max-w-56 py-2 pr-4 break-all">{t.allowOrigin ?? '-'}</td>
      <td className="py-2 pr-4">{t.allowCredentials ? 'true' : '-'}</td>
      <td className="py-2 pr-4">
        <Tag tone={FINDING_TONE[t.verdict]}>{t.verdict}</Tag>
      </td>
      <td className="min-w-64 py-2 text-muted-foreground">
        {t.message}
        {t.error && <span className="block text-neon-magenta">{t.error}</span>}
        {(t.allowMethods || t.allowHeaders) && (
          <span className="block text-foreground/70">
            {t.allowMethods && `Methods: ${t.allowMethods}`}
            {t.allowMethods && t.allowHeaders && ' · '}
            {t.allowHeaders && `Headers: ${t.allowHeaders}`}
          </span>
        )}
      </td>
    </tr>
  );
}

export function CorsResults({ data }: { data: CorsOutput }) {
  return (
    <div className="grid gap-4">
      <Panel title="Findings" bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Tested URL
          </span>
          <code className="min-w-0 flex-1 truncate" title={data.url}>
            {data.url}
          </code>
          <PivotLinks value={data.url} exclude="cors" />
        </div>
        <FindingsList findings={data.findings} />
      </Panel>

      <Panel title="Tests" bodyClassName="p-0">
        <div className="overflow-x-auto px-4 py-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                <th className="py-1 pr-4 font-normal">Test</th>
                <th className="py-1 pr-4 font-normal">Origin sent</th>
                <th className="py-1 pr-4 font-normal">Status</th>
                <th className="py-1 pr-4 font-normal">ACAO</th>
                <th className="py-1 pr-4 font-normal">ACAC</th>
                <th className="py-1 pr-4 font-normal">Verdict</th>
                <th className="py-1 font-normal">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.tests.map((t) => (
                <TestRow key={t.id} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
