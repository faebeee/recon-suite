import { useQuery } from '@tanstack/react-query';
import { StatusDot } from '@/components/cyber';
import { healthQuery } from './health-query';

export function ApiStatus() {
  const health = useQuery(healthQuery);
  const tone = health.isSuccess
    ? 'green'
    : health.isPending
      ? 'yellow'
      : 'magenta';
  const label = health.isSuccess
    ? `uplink v${health.data.version}`
    : health.isPending
      ? 'linking'
      : 'uplink down';
  return (
    <span
      className="flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase"
      title="API status"
    >
      <StatusDot tone={tone} pulse={health.isSuccess} />
      <span
        className={
          health.isError ? 'text-neon-magenta' : 'text-muted-foreground'
        }
      >
        {label}
      </span>
    </span>
  );
}
