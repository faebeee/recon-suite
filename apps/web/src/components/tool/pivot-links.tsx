import { Link } from '@tanstack/react-router';
import type { ToolId } from '@recon/shared';
import { toolsAccepting } from '@/features/registry';
import { cn } from '@/lib/utils';
import { toneText } from '@/lib/tones';

/** Icon links that open other tools with `value` as target ("pivot"). */
export function PivotLinks({
  value,
  exclude,
  className,
}: {
  value: string;
  exclude?: ToolId;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {toolsAccepting(value, exclude).map((tool) => {
        const Icon = tool.icon;
        return (
          <Link
            key={tool.id}
            to={tool.path}
            search={{ target: value }}
            title={`${tool.name}: ${value}`}
            aria-label={`Open ${value} in ${tool.name}`}
            data-accent
            className={cn(
              'inline-flex size-6 items-center justify-center border border-transparent opacity-60 transition hover:border-current hover:opacity-100',
              toneText[tool.tone],
            )}
          >
            <Icon className="size-3.5" />
          </Link>
        );
      })}
    </span>
  );
}
