import { useId, useMemo, type CSSProperties } from 'react';
import { geoEqualEarth, geoGraticule10, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countries50m from 'world-atlas/countries-50m.json';
import { countryNumericId } from '@/lib/countries';

const WIDTH = 960;
const ANTARCTICA = '010';
const KOSOVO_NAME = 'Kosovo'; // has no ISO numeric id in world-atlas

type CountryFeature = Feature<Geometry, { name: string }>;

interface Atlas {
  countries: CountryFeature[];
  height: number;
  path: ReturnType<typeof geoPath>;
  graticule: string;
}

let atlas: Atlas | undefined;

/** Projects the atlas once; the result is shared by every map instance. */
function getAtlas(): Atlas {
  if (atlas) return atlas;
  const topology = countries50m as unknown as Topology<{
    countries: GeometryCollection<{ name: string }>;
  }>;
  const collection = feature(
    topology,
    topology.objects.countries,
  ) as FeatureCollection<Geometry, { name: string }>;
  const countries = collection.features.filter((f) => f.id !== ANTARCTICA);
  const projection = geoEqualEarth().fitWidth(WIDTH, {
    type: 'FeatureCollection',
    features: countries,
  });
  const path = geoPath(projection);
  const [[, y0], [, y1]] = path.bounds({
    type: 'FeatureCollection',
    features: countries,
  });
  projection.translate([
    projection.translate()[0],
    projection.translate()[1] - y0,
  ]);
  atlas = {
    countries,
    height: Math.ceil(y1 - y0),
    path,
    graticule: path(geoGraticule10()) ?? '',
  };
  return atlas;
}

function matches(f: CountryFeature, alpha2: string) {
  if (alpha2 === 'XK') return f.properties.name === KOSOVO_NAME;
  const id = countryNumericId(alpha2);
  return id !== undefined && f.id === id;
}

/** Marker position: centroid of the country's largest polygon (ignores overseas parts). */
function markerPoint(path: Atlas['path'], features: CountryFeature[]) {
  let best: { area: number; point: [number, number] } | undefined;
  for (const f of features) {
    const g = f.geometry;
    const polygons: Polygon[] =
      g.type === 'Polygon'
        ? [g]
        : g.type === 'MultiPolygon'
          ? g.coordinates.map((coordinates) => ({
              type: 'Polygon',
              coordinates,
            }))
          : [];
    for (const p of polygons) {
      const area = path.area(p);
      const point = path.centroid(p);
      if (!best || area > best.area) best = { area, point };
    }
  }
  return best && Number.isFinite(best.point[0]) ? best.point : undefined;
}

export interface WorldMapSvgProps {
  /** ISO 3166-1 alpha-2 codes to highlight. */
  highlight: string[];
  label: string;
}

/** Heavy part of `WorldMap` (atlas data + projection); loaded lazily. */
export default function WorldMapSvg({ highlight, label }: WorldMapSvgProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { countries, height, path, graticule } = getAtlas();

  const { hits, markers } = useMemo(() => {
    const codes = [...new Set(highlight.map((c) => c.toUpperCase()))];
    const hitSet = new Set<CountryFeature>();
    const points: { code: string; point: [number, number] }[] = [];
    for (const code of codes) {
      const found = countries.filter((f) => matches(f, code));
      found.forEach((f) => hitSet.add(f));
      const point = markerPoint(path, found);
      if (point) points.push({ code, point });
    }
    return { hits: hitSet, markers: points };
  }, [highlight, countries, path]);

  const landDots = `geo-dots-land-${uid}`;
  const hitDots = `geo-dots-hit-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={label}
      className="block h-auto w-full"
      style={
        {
          '--geo-dots-land': `url(#${landDots})`,
          '--geo-dots-hit': `url(#${hitDots})`,
        } as CSSProperties
      }
    >
      <defs>
        <pattern
          id={landDots}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2.5" cy="2.5" r="1.25" data-geo-dot="land" />
        </pattern>
        <pattern
          id={hitDots}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2.5" cy="2.5" r="1.6" data-geo-dot="hit" />
        </pattern>
      </defs>
      <path d={graticule} data-geo="graticule" />
      <g>
        {countries.map((f, i) =>
          hits.has(f) ? null : (
            <path key={`${f.id ?? 'x'}-${i}`} d={path(f) ?? ''} data-geo="land">
              <title>{f.properties.name}</title>
            </path>
          ),
        )}
      </g>
      <g>
        {[...hits].map((f, i) => (
          <path key={`${f.id ?? 'x'}-${i}`} d={path(f) ?? ''} data-geo="hit">
            <title>{f.properties.name}</title>
          </path>
        ))}
      </g>
      {markers.map(({ code, point: [x, y] }) => (
        <g key={code} transform={`translate(${x} ${y})`} data-geo="marker">
          <circle r="14" data-geo="marker-ring" />
          <line x1="-22" x2="-8" y1="0" y2="0" />
          <line x1="8" x2="22" y1="0" y2="0" />
          <line x1="0" x2="0" y1="-22" y2="-8" />
          <line x1="0" x2="0" y1="8" y2="22" />
          <circle r="3.5" data-geo="marker-dot" />
        </g>
      ))}
    </svg>
  );
}
