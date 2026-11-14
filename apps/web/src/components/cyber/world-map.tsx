import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import type { WorldMapSvgProps } from './world-map-svg';

// The atlas (~700 KB of TopoJSON) is only loaded when a map is shown.
const WorldMapSvg = lazy(() => import('./world-map-svg'));

interface WorldMapProps extends WorldMapSvgProps {
  className?: string;
}

/**
 * World map that highlights countries by ISO alpha-2 code. Colours come from the
 * theme: styled through `data-slot="geo-map"` / `data-geo` hooks in styles.css and
 * the theme files (HUD outlines in `cyber`, dot matrix in `nothing`).
 */
export function WorldMap({ className, ...props }: WorldMapProps) {
  return (
    <figure
      data-slot="geo-map"
      className={cn('relative m-0 overflow-hidden bg-grid', className)}
    >
      <Suspense
        fallback={
          <div
            className="aspect-[2.05] w-full animate-pulse bg-muted/30"
            aria-label="Loading map"
          />
        }
      >
        <WorldMapSvg {...props} />
      </Suspense>
    </figure>
  );
}
