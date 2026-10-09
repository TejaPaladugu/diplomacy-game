import geometry from './geometry.json';

export const SCALE = 0.065;
export const MAP_CENTER_X = geometry.width / 2;
export const MAP_CENTER_Y = geometry.height / 2;

export function toWorld(x: number, y: number): [number, number] {
  return [(x - MAP_CENTER_X) * SCALE, (y - MAP_CENTER_Y) * SCALE];
}

// Hand-picked for visual variety ("within reason" topography), approximating where the
// real Alps/Carpathians/Caucasus/Scandinavian mountains actually fall among these
// provinces - not a literal elevation model, but not arbitrary either.
const MOUNTAINOUS = new Set(['tyr', 'boh', 'arm', 'alb', 'gal', 'ser', 'nwy', 'pie', 'wal']);
const FORESTED = new Set(['ruh', 'bur', 'ukr', 'lvn', 'fin', 'sil', 'war']);

export function hashUnit(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/** terrainMode 'flat' gives the authentic parchment-map look (minimal relief); 'relief'
 * exaggerates height for a readable 3D terrain view. Both toggleable from the UI. */
export function provinceHeight(id: string, type: 'land' | 'sea', terrainMode: 'flat' | 'relief' = 'relief'): number {
  if (type === 'sea') return 0.12;
  if (terrainMode === 'flat') return 0.3 + hashUnit(id) * 0.04;
  const jitter = hashUnit(id) * 0.35;
  if (MOUNTAINOUS.has(id)) return 1.9 + jitter;
  if (FORESTED.has(id)) return 1.15 + jitter * 0.6;
  return 0.85 + jitter * 0.5;
}

export function provinceTint(id: string, type: 'land' | 'sea'): number {
  if (type === 'sea') return 0;
  if (MOUNTAINOUS.has(id)) return 1;
  if (FORESTED.has(id)) return 2;
  return 3;
}
