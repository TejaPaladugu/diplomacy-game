import geometry from './geometry.json';

export const SCALE = 0.065;
export const MAP_CENTER_X = geometry.width / 2;
export const MAP_CENTER_Y = geometry.height / 2;

export function toWorld(x: number, y: number): [number, number] {
  return [(x - MAP_CENTER_X) * SCALE, (y - MAP_CENTER_Y) * SCALE];
}

type GeometryData = { provinces: Record<string, { elevation?: number; vertexElevations?: number[] }> };
const geo = geometry as unknown as GeometryData;

// Real elevation data (see scripts/generateMapGeometry.mjs) is stretched into roughly this
// world-unit range; used as a fallback when a province is somehow missing elevation data.
const ELEV_BASE = 0.3;
const ELEV_RANGE = 2.3;

export function hashUnit(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/** terrainMode 'flat' gives the authentic parchment-map look (minimal relief); 'relief'
 * uses real elevation data for an actually varied 3D terrain view. Both toggleable from
 * the UI. Returns a single scalar (the province's elevation at its seed point) for
 * placing units/markers/labels; the terrain mesh itself uses per-vertex elevation for a
 * properly undulating surface (see ProvinceMesh.tsx). */
export function provinceHeight(id: string, type: 'land' | 'sea', terrainMode: 'flat' | 'relief' = 'relief'): number {
  if (type === 'sea') return 0.12;
  if (terrainMode === 'flat') return 0.3 + hashUnit(id) * 0.04;
  return geo.provinces[id]?.elevation ?? ELEV_BASE + hashUnit(id) * ELEV_RANGE;
}

export function provinceVertexHeights(id: string, terrainMode: 'flat' | 'relief', vertexCount: number): number[] | undefined {
  if (terrainMode === 'flat') return undefined; // flat mode: caller uses a single uniform height
  const v = geo.provinces[id]?.vertexElevations;
  return v && v.length === vertexCount ? v : undefined;
}

// Higher ground reads as slightly darker/rockier - a continuous gradient driven by the
// same real elevation data as the height itself, rather than a fixed category.
export function provinceTintFactor(id: string, type: 'land' | 'sea'): number {
  if (type === 'sea') return 1;
  const h = geo.provinces[id]?.elevation;
  if (h === undefined) return 1;
  const t = Math.max(0, Math.min(1, (h - ELEV_BASE) / ELEV_RANGE));
  return 1 - t * 0.22;
}
