import { queryOptions, useQuery } from '@tanstack/react-query';
import { Laptop, type LucideIcon } from 'lucide-react';
import {
  SYSTEM_RUNTIME_ENDPOINT,
  type RuntimeInfo,
  type RuntimeLocation,
  type SupportStatus,
  type ToolId,
  type ToolRuntime,
} from '@recon/shared';
import { apiFetch } from '@/lib/api-client';
import type { Tone } from '@/lib/tones';

/** Where/with what each tool runs. Facts are gathered at API boot, so cache for long. */
export const runtimeQuery = queryOptions({
  queryKey: ['system', 'runtime'],
  queryFn: () => apiFetch<RuntimeInfo>(SYSTEM_RUNTIME_ENDPOINT),
  staleTime: 5 * 60_000,
  retry: false,
});

/** Runtime of one tool; undefined while loading or when the API is unreachable. */
export function useToolRuntime(id: ToolId): ToolRuntime | undefined {
  const { data } = useQuery(runtimeQuery);
  return data?.tools.find((t) => t.id === id);
}

export interface LocationMeta {
  label: string;
  /** Compact label for tight spaces (sidebar). */
  short: string;
  icon: LucideIcon;
  tone: Tone;
  description: string;
}

export const LOCATION_META: Record<RuntimeLocation, LocationMeta> = {
  host: {
    label: 'API host',
    short: 'host',
    icon: Laptop,
    tone: 'muted',
    description: 'Runs natively on the machine hosting the API.',
  },
};

export const STATUS_TONE: Record<SupportStatus, Tone> = {
  ok: 'green',
  limited: 'yellow',
  unavailable: 'magenta',
  disabled: 'muted',
};
