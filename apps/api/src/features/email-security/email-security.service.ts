import { Injectable, NotFoundException } from '@nestjs/common';
import { Resolver } from 'node:dns/promises';
import {
  COMMON_DKIM_SELECTORS,
  gradeFindings,
  type DkimSelectorResult,
  type DmarcReport,
  type EmailSecurityOutput,
  type EmailSecurityParams,
} from '@recon/shared';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import { buildEmailFindings } from './email-findings.js';
import {
  dmarcCandidates,
  parseDkim,
  parseDmarc,
  parseTags,
  tagRecord,
} from './email-records.js';
import { evaluateSpf } from './spf.js';

const RESOLVERS = ['1.1.1.1', '1.0.0.1'];

@Injectable()
export class EmailSecurityService {
  async check({
    target,
    dkimSelectors,
  }: EmailSecurityParams): Promise<EmailSecurityOutput> {
    const r = new Resolver({ timeout: 3000, tries: 2 });
    r.setServers(RESOLVERS);
    const txt = (name: string) => resolveTxt(r, name);

    const [mx, apexTxt] = await Promise.all([
      r.resolveMx(target).then(
        (rs) =>
          [...rs]
            .sort((a, b) => a.priority - b.priority)
            .map((m) => `${m.priority} ${m.exchange || '.'}`),
        (err: NodeJS.ErrnoException) => (err.code === 'ENOTFOUND' ? null : []),
      ),
      txt(target).catch((err: NodeJS.ErrnoException) =>
        err.code === 'ENOTFOUND' ? null : [],
      ),
    ]);
    if (mx === null && apexTxt === null && !(await exists(r, target))) {
      throw new NotFoundException(`NXDOMAIN: ${target} does not exist`);
    }

    const selectors = [
      ...new Set([...COMMON_DKIM_SELECTORS, ...dkimSelectors]),
    ];
    const [spf, dmarc, dkim, mtaSts, tlsRpt, bimi] = await Promise.all([
      evaluateSpf(target, async (name) =>
        name === target && apexTxt ? apexTxt : txt(name),
      ),
      this.findDmarc(txt, target),
      mapConcurrent(selectors, 6, async (sel) => {
        const rec = await txt(`${sel}._domainkey.${target}`).catch(() => []);
        const dkimRecord = rec.find((t) => /(^|;)\s*p=/i.test(t));
        return dkimRecord ? parseDkim(sel, dkimRecord) : undefined;
      }),
      txt(`_mta-sts.${target}`)
        .catch(() => [])
        .then(tagRecord(/^v=STSv1/i)),
      txt(`_smtp._tls.${target}`)
        .catch(() => [])
        .then(tagRecord(/^v=TLSRPTv1/i)),
      txt(`default._bimi.${target}`)
        .catch(() => [])
        .then(tagRecord(/^v=BIMI1/i)),
    ]);

    const data: Omit<EmailSecurityOutput, 'report'> = {
      domain: target,
      mx: mx ?? [],
      spf,
      dmarc,
      dkim: {
        checked: selectors.length,
        found: dkim.filter((k): k is DkimSelectorResult => !!k),
      },
      mtaSts: mtaSts ? { record: mtaSts, id: parseTags(mtaSts).id } : undefined,
      tlsRpt: tlsRpt
        ? {
            record: tlsRpt,
            rua: (parseTags(tlsRpt).rua ?? '').split(',').filter(Boolean),
          }
        : undefined,
      bimi: bimi
        ? { record: bimi, logo: parseTags(bimi).l || undefined }
        : undefined,
    };
    return { ...data, report: gradeFindings(buildEmailFindings(data)) };
  }

  private async findDmarc(
    txt: (name: string) => Promise<string[]>,
    domain: string,
  ): Promise<DmarcReport> {
    for (const candidate of dmarcCandidates(domain)) {
      const name = `_dmarc.${candidate}`;
      const record = tagRecord(/^v=DMARC1/i)(await txt(name).catch(() => []));
      if (record) return parseDmarc(name, record);
    }
    return { rua: [], ruf: [] };
  }
}

async function resolveTxt(r: Resolver, name: string): Promise<string[]> {
  try {
    return (await r.resolveTxt(name)).map((chunks) => chunks.join(''));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENODATA') return [];
    throw err;
  }
}

/** The name may exist without MX/TXT (e.g. only A records). */
async function exists(r: Resolver, name: string): Promise<boolean> {
  const probes = [r.resolve4(name), r.resolve6(name), r.resolveNs(name)];
  const results = await Promise.allSettled(probes);
  return results.some(
    (res) =>
      res.status === 'fulfilled' ||
      (res.reason as NodeJS.ErrnoException).code !== 'ENOTFOUND',
  );
}
