import { isIpLiteral } from '@recon/shared';

/**
 * Export for Intel View (https://github.com/faebeee/intel-view): its canvas creates notes
 * when a document in the `intel-view/notes` v1 format is pasted (Ctrl/Cmd+V). Spec:
 * intel-view `docs/note-import-format.md`.
 */
export const INTEL_VIEW_FORMAT = 'intel-view/notes';
export const INTEL_VIEW_VERSION = 1;
/** Intel View rejects pastes with more notes than this. */
export const INTEL_VIEW_MAX_NOTES = 500;

export interface IntelViewNote {
  type?: string;
  title?: string;
  content?: string;
  tags?: string[];
  children?: IntelViewNote[];
}

export interface IntelViewDocument {
  format: typeof INTEL_VIEW_FORMAT;
  version: typeof INTEL_VIEW_VERSION;
  source?: string;
  notes: IntelViewNote[];
}

export interface IntelViewItem {
  label: string;
  group: string;
  detail?: string;
  /** Host, IP or URL; IPs and http(s) URLs become typed notes. */
  pivot?: string;
}

export interface IntelViewExport {
  document: IntelViewDocument;
  /** Items left out to stay within `INTEL_VIEW_MAX_NOTES`. */
  omitted: number;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** `ip` / `url` notes take exactly one value as content; everything else is markdown. */
function valueNote(value: string): Pick<IntelViewNote, 'type' | 'content'> {
  if (isIpLiteral(value)) return { type: 'ip', content: value };
  if (isHttpUrl(value)) return { type: 'url', content: value };
  return {};
}

function itemNote(item: IntelViewItem, tags: string[]): IntelViewNote {
  const typed = item.pivot ? valueNote(item.pivot) : {};
  if (typed.type) {
    // Typed notes have no free body, so the detail goes into the title.
    const title = [item.label, item.detail].filter(Boolean).join(' · ');
    return { ...typed, title, tags };
  }
  const body = [
    item.detail,
    item.pivot && item.pivot !== item.label ? `\`${item.pivot}\`` : undefined,
  ].filter(Boolean);
  return {
    type: 'standard',
    title: item.label,
    ...(body.length > 0 && { content: body.join('\n\n') }),
    tags,
  };
}

/**
 * Builds a note tree: the target as root, one note per group with at least one item, the
 * items below their group. Items are cut so the whole document has at most
 * `INTEL_VIEW_MAX_NOTES` notes.
 */
export function buildIntelViewExport({
  source,
  tool,
  center,
  groups,
  items,
}: {
  /** Shown by Intel View in the import confirmation. */
  source: string;
  /** Tag added to every note, e.g. the tool id. */
  tool?: string;
  center: string;
  groups: { id: string; label: string }[];
  items: IntelViewItem[];
}): IntelViewExport {
  const baseTags = ['recon-suite', ...(tool ? [tool] : [])];
  const used = groups.filter((g) => items.some((i) => i.group === g.id));
  // Root + group notes count towards the limit too.
  let budget = INTEL_VIEW_MAX_NOTES - 1 - used.length;
  let omitted = 0;

  const groupNotes: IntelViewNote[] = used.map((g) => {
    const members = items.filter((i) => i.group === g.id);
    const kept = members.slice(0, Math.max(0, budget));
    budget -= kept.length;
    omitted += members.length - kept.length;
    const tags = [...baseTags, g.label];
    return {
      type: 'standard',
      title: g.label,
      content: `${members.length} item${members.length === 1 ? '' : 's'}`,
      tags,
      children: kept.map((i) => itemNote(i, tags)),
    };
  });

  const root: IntelViewNote = {
    ...(valueNote(center).type ? valueNote(center) : { type: 'standard' }),
    title: center,
    tags: baseTags,
    children: groupNotes,
  };

  return {
    document: {
      format: INTEL_VIEW_FORMAT,
      version: INTEL_VIEW_VERSION,
      source,
      notes: [root],
    },
    omitted,
  };
}
