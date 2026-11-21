/** One entry of the command palette: a tool or an app page. */
export interface CommandItem {
  id: string;
  name: string;
  /** Searchable extras: tool code (W-15), id, tagline, category. */
  keywords: string[];
}

/**
 * Ranks items for a query. Lower is better; undefined means no match.
 * 0 exact name, 1 name prefix, 2 word prefix in the name ("scan" -> "Nmap Scan"),
 * 3 name contains it, 4 a keyword starts with it (code, id), 5 a keyword contains it,
 * 6 the letters appear in order in the name ("dbst" -> "Dir Buster").
 */
function rank(item: CommandItem, q: string): number | undefined {
  const name = item.name.toLowerCase();
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.split(/[\s/&()-]+/).some((w) => w.startsWith(q))) return 2;
  if (name.includes(q)) return 3;
  const keywords = item.keywords.map((k) => k.toLowerCase());
  if (keywords.some((k) => k.startsWith(q))) return 4;
  if (keywords.some((k) => k.includes(q))) return 5;
  if (isSubsequence(q.replace(/\s+/g, ''), name)) return 6;
  return undefined;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) if (ch === needle[i]) i++;
  return needle.length > 0 && i === needle.length;
}

/**
 * Items matching the query, best first; ties keep their original order. An empty query
 * returns every item unchanged.
 */
export function searchCommands<T extends CommandItem>(
  items: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items
    .map((item, index) => ({ item, index, score: rank(item, q) }))
    .filter(
      (r): r is { item: T; index: number; score: number } =>
        r.score !== undefined,
    )
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((r) => r.item);
}
