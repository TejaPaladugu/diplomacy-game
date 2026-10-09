import geometry from './geometry.json';
import type { Province } from '../types/domain';

export const MAP_WIDTH = geometry.width;
export const MAP_HEIGHT = geometry.height;

export interface MapCell {
  province: Province;
  polygon: [number, number][];
  centroid: [number, number];
}

type GeometryData = {
  width: number;
  height: number;
  worldLand: [number, number][][];
  provinces: Record<string, { x: number; y: number; polygon: [number, number][] }>;
};

const geo = geometry as unknown as GeometryData;

export const WORLD_LAND_RINGS: [number, number][][] = geo.worldLand;

/**
 * Builds map cells using pre-computed, real-coastline-clipped province shapes
 * (generated at build time by scripts/generateMapGeometry.mjs from public-domain
 * Natural Earth data) rather than raw Voronoi polygons, so the map reads as an
 * actual map of Europe instead of abstract cells. Falls back to the province's own
 * x/y (and an empty polygon) if geometry data is missing for some id.
 */
export function buildMapCells(provinces: Province[]): MapCell[] {
  return provinces.map((province) => {
    const g = geo.provinces[province.id];
    if (!g) return { province, polygon: [], centroid: [province.x, province.y] };
    return { province, polygon: g.polygon, centroid: [g.x, g.y] };
  });
}

/** Real-geography x/y for a province id (falls back to the server-provided
 * coordinate if this id is missing from the generated geometry for some reason). */
export function geoXY(id: string, fallback: [number, number]): [number, number] {
  const g = geo.provinces[id];
  return g ? [g.x, g.y] : fallback;
}

export function polygonToPath(polygon: [number, number][]): string {
  if (polygon.length === 0) return '';
  return `M${polygon.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
}
