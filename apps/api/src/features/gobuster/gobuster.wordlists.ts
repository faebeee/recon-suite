import { existsSync, readFileSync, statSync } from 'node:fs';
import type { GobusterWordlist } from '@recon/shared';
import { WORDLISTS } from '../../core/wordlists/web-content.js';

/**
 * Wordlists gobuster may use: the built-in lists plus well-known lists at fixed install
 * paths (Kali/Parrot/Debian packages, Homebrew, manual SecLists checkouts). This is the
 * allowlist: a client only ever sends an id, and the path handed to gobuster comes from here
 * after checking that the file exists (AGENTS.md rule 7).
 */
interface SystemWordlist {
  id: string;
  label: string;
  /** Candidate locations, first existing one wins. */
  paths: string[];
}

const SECLISTS_ROOTS = [
  '/usr/share/seclists',
  '/usr/share/wordlists/seclists',
  '/opt/homebrew/share/seclists',
  '/usr/local/share/seclists',
  '/opt/SecLists',
  '/opt/seclists',
];
const seclists = (rel: string) => SECLISTS_ROOTS.map((r) => `${r}/${rel}`);

export const SYSTEM_WORDLISTS: SystemWordlist[] = [
  {
    id: 'dirb-common',
    label: 'dirb common.txt',
    paths: [
      '/usr/share/wordlists/dirb/common.txt',
      '/usr/share/dirb/wordlists/common.txt',
    ],
  },
  {
    id: 'dirb-big',
    label: 'dirb big.txt',
    paths: [
      '/usr/share/wordlists/dirb/big.txt',
      '/usr/share/dirb/wordlists/big.txt',
    ],
  },
  {
    id: 'dirbuster-small',
    label: 'DirBuster directory-list-2.3-small',
    paths: [
      '/usr/share/wordlists/dirbuster/directory-list-2.3-small.txt',
      '/usr/share/dirbuster/wordlists/directory-list-2.3-small.txt',
    ],
  },
  {
    id: 'dirbuster-medium',
    label: 'DirBuster directory-list-2.3-medium',
    paths: [
      '/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt',
      '/usr/share/dirbuster/wordlists/directory-list-2.3-medium.txt',
    ],
  },
  {
    id: 'seclists-common',
    label: 'SecLists Web-Content/common.txt',
    paths: seclists('Discovery/Web-Content/common.txt'),
  },
  {
    id: 'seclists-quickhits',
    label: 'SecLists Web-Content/quickhits.txt',
    paths: seclists('Discovery/Web-Content/quickhits.txt'),
  },
  {
    id: 'seclists-raft-small-directories',
    label: 'SecLists raft-small-directories',
    paths: seclists('Discovery/Web-Content/raft-small-directories.txt'),
  },
  {
    id: 'seclists-raft-medium-directories',
    label: 'SecLists raft-medium-directories',
    paths: seclists('Discovery/Web-Content/raft-medium-directories.txt'),
  },
  {
    id: 'seclists-raft-small-files',
    label: 'SecLists raft-small-files',
    paths: seclists('Discovery/Web-Content/raft-small-files.txt'),
  },
];

const BUILT_IN: { id: string; label: string; words: readonly string[] }[] = [
  {
    id: 'builtin-quick',
    label: 'Built-in quick',
    words: WORDLISTS.quick,
  },
  {
    id: 'builtin-common',
    label: 'Built-in common',
    words: WORDLISTS.common,
  },
];

/** File-system access, injected so tests don't depend on the machine's installed lists. */
export interface WordlistFs {
  isFile(path: string): boolean;
  /** Number of lines (cached per path and modification time). */
  countLines(path: string): number;
}

const lineCache = new Map<string, { mtimeMs: number; lines: number }>();

export const NODE_WORDLIST_FS: WordlistFs = {
  isFile: (path) => existsSync(path) && statSync(path).isFile(),
  countLines: (path) => {
    const { mtimeMs } = statSync(path);
    const cached = lineCache.get(path);
    if (cached?.mtimeMs === mtimeMs) return cached.lines;
    const text = readFileSync(path, 'utf8');
    let lines = 0;
    for (const line of text.split('\n')) {
      // Comment lines (the DirBuster lists start with a licence header) and blanks
      // are skipped by gobuster too.
      if (line.trim() && !line.startsWith('#')) lines++;
    }
    lineCache.set(path, { mtimeMs, lines });
    return lines;
  },
};

/** A wordlist ready for gobuster: an installed file, or built-in words to write out. */
export type ResolvedWordlist = GobusterWordlist &
  (
    { path: string; words?: never } | { path?: never; words: readonly string[] }
  );

/** Every usable wordlist on this host: built-in first, then installed system lists. */
export function availableWordlists(fs: WordlistFs): ResolvedWordlist[] {
  const builtIn: ResolvedWordlist[] = BUILT_IN.map((b) => ({
    id: b.id,
    label: b.label,
    lines: b.words.length,
    builtIn: true,
    words: b.words,
  }));
  const system: ResolvedWordlist[] = SYSTEM_WORDLISTS.flatMap((w) => {
    const path = w.paths.find((p) => fs.isFile(p));
    return path
      ? [
          {
            id: w.id,
            label: w.label,
            path,
            lines: fs.countLines(path),
            builtIn: false,
          },
        ]
      : [];
  });
  return [...builtIn, ...system];
}

/** Looks an id up in the allowlist; undefined when it is unknown or not installed. */
export function resolveWordlist(
  id: string,
  fs: WordlistFs,
): ResolvedWordlist | undefined {
  return availableWordlists(fs).find((w) => w.id === id);
}
