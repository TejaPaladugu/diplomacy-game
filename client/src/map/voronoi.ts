import geometry from './geometry.json';
import type { Province } from '../types/domain';

export const MAP_WIDTH = geometry.width;
export const MAP_HEIGHT = geometry.height;

export interface MapCell {
  province: Province;
  polygon: [number, number][];
  centroid: [number, number];
  /** Real elevation (world units) at the province's seed point - a single scalar used to
   * place units/markers/labels on the surface. */
  elevation?: number;
  /** Real elevation per polygon vertex (same length/order as `polygon`), used to give the
   * terrain mesh an actually undulating top surface instead of one flat block height. */
  vertexElevations?: number[];
}

type GeometryData = {
  width: number;
  height: number;
  worldLand: [number, number][][];
  provinces: Record<
    string,
    { x: number; y: number; polygon: [number, number][]; radius: number; elevation?: number; vertexElevations?: number[] }
  >;
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
    return { province, polygon: g.polygon, centroid: [g.x, g.y], elevation: g.elevation, vertexElevations: g.vertexElevations };
  });
}

/** Real-geography x/y for a province id (falls back to the server-provided
 * coordinate if this id is missing from the generated geometry for some reason). */
export function geoXY(id: string, fallback: [number, number]): [number, number] {
  const g = geo.provinces[id];
  return g ? [g.x, g.y] : fallback;
}

/** Approximate on-screen "size" (pixel-space radius) of a province's cell, used to fade
 * in its label only once zoomed in enough that it has room to be legible. */
export function geoRadius(id: string): number {
  return geo.provinces[id]?.radius ?? 0;
}

export function polygonToPath(polygon: [number, number][]): string {
  if (polygon.length === 0) return '';
  return `M${polygon.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
}
