import { useQuery } from '@tanstack/react-query';
import { FolderKanban } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { engagementsQuery, useActiveEngagement } from '@/lib/engagement';

const NONE = '__none__';

/** Picks the engagement new tool runs are recorded to. */
export function EngagementSwitcher() {
  const { id, setId, engagement } = useActiveEngagement();
  const list = useQuery(engagementsQuery);
  const options: { id: string; name: string }[] = (list.data ?? []).filter(
    (e) => e.status === 'active',
  );
  // Keep the current one selectable even if it is archived or still loading.
  if (id && !options.some((e) => e.id === id)) {
    options.unshift({ id, name: engagement?.name ?? 'Loading…' });
  }

  return (
    <Select
      value={id ?? NONE}
      onValueChange={(v) => setId(v === NONE ? null : v)}
    >
      <SelectTrigger
        size="sm"
        aria-label="Active engagement"
        className="h-7 max-w-44 gap-1.5 px-2 text-[11px] tracking-[0.2em] uppercase"
      >
        <FolderKanban
          className={id ? 'size-3.5 text-primary' : 'size-3.5'}
          aria-hidden
        />
        <span className="hidden min-w-0 truncate sm:inline">
          <SelectValue placeholder="Engagement" />
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem
          value={NONE}
          className="text-[11px] tracking-[0.2em] uppercase"
        >
          No engagement
        </SelectItem>
        {options.map((e) => (
          <SelectItem
            key={e.id}
            value={e.id}
            className="text-[11px] tracking-[0.15em]"
          >
            {e.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
