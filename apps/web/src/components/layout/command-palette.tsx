import { useNavigate } from '@tanstack/react-router';
import {
  Activity,
  CornerDownLeft,
  FolderKanban,
  LayoutGrid,
  ListChecks,
  Search,
  type LucideIcon,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react';
import { CATEGORY_LABELS } from '@recon/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { TOOLS, type ToolPath } from '@/features/registry';
import { searchCommands, type CommandItem } from '@/lib/command-search';
import { toneText, type Tone } from '@/lib/tones';
import { cn } from '@/lib/utils';

interface PaletteItem extends CommandItem {
  /** Route to open. */
  to: ToolPath | '/' | '/batch' | '/engagements' | '/system';
  icon: LucideIcon;
  tone: Tone;
  /** Right-aligned hint: tool code or "page". */
  hint: string;
  description?: string;
}

const page = (
  id: string,
  name: string,
  to: PaletteItem['to'],
  icon: LucideIcon,
): PaletteItem => ({
  id: `page:${id}`,
  name,
  to,
  icon,
  keywords: ['page'],
  tone: 'muted',
  hint: 'page',
});

const PAGES: PaletteItem[] = [
  page('dashboard', 'Dashboard', '/', LayoutGrid),
  page('batch', 'Batch', '/batch', ListChecks),
  page('engagements', 'Engagements', '/engagements', FolderKanban),
  page('system', 'System', '/system', Activity),
];

const ITEMS: PaletteItem[] = [
  ...TOOLS.map((t) => ({
    id: t.id,
    name: t.name,
    keywords: [t.code, t.id, t.tagline, CATEGORY_LABELS[t.category]],
    to: t.path,
    icon: t.icon,
    tone: t.tone,
    hint: t.code,
    description: t.tagline,
  })),
  ...PAGES,
];

/** Opens the palette with Cmd+K (macOS) or Ctrl+K; also from the top bar button. */
export function useCommandPaletteShortcut(toggle: () => void) {
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        e.key.toLowerCase() === 'k'
      ) {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);
}

/** Cmd/Ctrl+K launcher: type a tool or page name, pick it with the arrow keys, Enter opens it. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[15vh] translate-y-0 gap-0 p-0 sm:max-w-xl"
        data-slot="command-palette"
      >
        <DialogTitle className="sr-only">Open a tool or page</DialogTitle>
        <DialogDescription className="sr-only">
          Type to filter, use the arrow keys to choose and Enter to open.
        </DialogDescription>
        {/* Mounted only while open, so every opening starts with an empty query. */}
        {open && <PaletteBody onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PaletteBody({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => searchCommands(ITEMS, query), [query]);
  const current = results[Math.min(active, results.length - 1)];

  // Keep the highlighted row visible while moving through a long list.
  useEffect(() => {
    if (!current) return;
    document
      .getElementById(optionId(listId, current.id))
      ?.scrollIntoView({ block: 'nearest' });
  }, [current, listId]);

  const open = useCallback(
    (item: PaletteItem | undefined) => {
      if (!item) return;
      onDone();
      void navigate({ to: item.to });
    },
    [navigate, onDone],
  );

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const last = results.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => (i >= last ? 0 : i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => (i <= 0 ? last : i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(last);
        break;
      case 'Enter':
        e.preventDefault();
        open(current);
        break;
    }
  }

  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            current ? optionId(listId, current.id) : undefined
          }
          aria-label="Search tools and pages"
          placeholder="Search tools and pages..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="none"
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden shrink-0 border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
          ESC
        </kbd>
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Tools and pages"
        className="min-h-0 flex-1 overflow-y-auto py-1"
      >
        {results.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing matches &ldquo;{query}&rdquo;.
          </li>
        )}
        {results.map((item) => {
          const Icon = item.icon;
          const selected = item === current;
          return (
            <li
              key={item.id}
              id={optionId(listId, item.id)}
              role="option"
              aria-selected={selected}
              // Mouse picks follow the pointer, like the arrow keys.
              onMouseMove={() => setActive(results.indexOf(item))}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => open(item)}
              className={cn(
                'flex cursor-pointer items-center gap-3 border-l-2 px-4 py-2 text-sm',
                selected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-transparent text-muted-foreground',
              )}
            >
              <Icon
                data-accent
                aria-hidden
                className={cn('size-4 shrink-0', toneText[item.tone])}
              />
              <span className="shrink-0 font-semibold text-foreground">
                {item.name}
              </span>
              {item.description && (
                <span className="min-w-0 truncate text-xs">
                  {item.description}
                </span>
              )}
              <span className="ml-auto flex shrink-0 items-center gap-2 text-[10px] tracking-[0.15em] uppercase">
                {item.hint}
                {selected && (
                  <CornerDownLeft className="size-3.5" aria-hidden />
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
        <span>↑↓ select</span>
        <span>↵ open</span>
        <span>esc close</span>
      </div>
    </div>
  );
}

function optionId(listId: string, itemId: string): string {
  return `${listId}-${itemId.replace(/[^a-z0-9-]/gi, '-')}`;
}
