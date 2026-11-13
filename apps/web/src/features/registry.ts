import {
  ArrowRightLeft,
  Bluetooth,
  Bug,
  Building2,
  Cloud,
  FileCode2,
  FileSearch,
  Fingerprint,
  FolderOpen,
  Globe,
  Globe2,
  History,
  KeyRound,
  Layers,
  LockKeyhole,
  MailCheck,
  Network,
  Radar,
  Router,
  ScanSearch,
  Server,
  Share2,
  ShieldCheck,
  Terminal,
  Unlink,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import {
  TOOL_CATALOG,
  TOOL_IDS,
  type ToolId,
  type ToolMeta,
} from '@recon/shared';
import type { Tone } from '@/lib/tones';

/** Kinds of target a tool accepts; used to offer pivots between tools. */
export type TargetKind = 'domain' | 'ip' | 'url';

export interface ToolUi {
  icon: LucideIcon;
  tone: Tone;
  accepts: TargetKind[];
}

/** UI-only metadata per tool. Register new tools here (metadata lives in @recon/shared). */
export const TOOL_UI: Record<ToolId, ToolUi> = {
  dns: { icon: Globe, tone: 'cyan', accepts: ['domain'] },
  subdomains: { icon: ScanSearch, tone: 'cyan', accepts: ['domain'] },
  whois: { icon: Fingerprint, tone: 'magenta', accepts: ['domain', 'ip'] },
  'email-security': { icon: MailCheck, tone: 'green', accepts: ['domain'] },
  'ip-intel': { icon: Server, tone: 'magenta', accepts: ['domain', 'ip'] },
  'http-headers': {
    icon: ShieldCheck,
    tone: 'yellow',
    accepts: ['domain', 'url'],
  },
  tls: { icon: Radar, tone: 'yellow', accepts: ['domain', 'ip'] },
  'web-files': { icon: FileSearch, tone: 'yellow', accepts: ['domain', 'url'] },
  'tech-fingerprint': {
    icon: Layers,
    tone: 'yellow',
    accepts: ['domain', 'url'],
  },
  ports: { icon: Network, tone: 'green', accepts: ['domain', 'ip'] },
  // Free-text targets (product, organisation): not offered as pivots by target kind.
  'zone-transfer': {
    icon: ArrowRightLeft,
    tone: 'magenta',
    accepts: ['domain'],
  },
  dnssec: { icon: KeyRound, tone: 'green', accepts: ['domain'] },
  takeover: { icon: Unlink, tone: 'magenta', accepts: ['domain'] },
  'cve-lookup': { icon: Bug, tone: 'magenta', accepts: [] },
  'cert-search': { icon: Building2, tone: 'cyan', accepts: [] },
  'reverse-ip': { icon: Share2, tone: 'cyan', accepts: ['ip', 'domain'] },
  'cloud-storage': { icon: Cloud, tone: 'yellow', accepts: ['domain'] },
  wayback: { icon: History, tone: 'cyan', accepts: ['domain'] },
  cors: { icon: Globe2, tone: 'magenta', accepts: ['domain', 'url'] },
  'tls-audit': { icon: LockKeyhole, tone: 'yellow', accepts: ['domain', 'ip'] },
  'js-endpoints': { icon: FileCode2, tone: 'cyan', accepts: ['domain', 'url'] },
  'exposed-files': {
    icon: FolderOpen,
    tone: 'magenta',
    accepts: ['domain', 'url'],
  },
  'banner-grab': { icon: Terminal, tone: 'green', accepts: ['domain', 'ip'] },
  // Local tool: no target, so it never appears in pivots or quick-target.
  'host-scan': { icon: Router, tone: 'green', accepts: [] },
  wifi: { icon: Wifi, tone: 'cyan', accepts: [] },
  bluetooth: { icon: Bluetooth, tone: 'magenta', accepts: [] },
};

export type ToolPath = `/tools/${ToolId}`;

export function toolPath(id: ToolId): ToolPath {
  return `/tools/${id}`;
}

export type ToolEntry = ToolMeta & ToolUi & { path: ToolPath };

export const TOOLS: ToolEntry[] = TOOL_IDS.map((id) => ({
  ...TOOL_CATALOG[id],
  ...TOOL_UI[id],
  path: toolPath(id),
}));

export function getTool(id: ToolId): ToolEntry {
  return TOOLS.find((t) => t.id === id)!;
}

const IP_RE = /^(\d{1,3}(\.\d{1,3}){3}|[0-9a-f:]+:[0-9a-f:]*)$/i;

export function detectTargetKind(value: string): TargetKind {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return 'url';
  if (IP_RE.test(v)) return 'ip';
  return 'domain';
}

/** Tools that can take `value` as their target. */
export function toolsAccepting(value: string, exclude?: ToolId): ToolEntry[] {
  const kind = detectTargetKind(value);
  return TOOLS.filter((t) => t.id !== exclude && t.accepts.includes(kind));
}
