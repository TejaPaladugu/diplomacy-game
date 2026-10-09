import { Delaunay } from 'd3-delaunay';
import type { Province } from '../types/domain';

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;

export interface MapCell {
  province: Province;
  polygon: [number, number][];
  centroid: [number, number];
}

/**
 * Builds a Voronoi tessellation from each province's representative coordinate,
 * producing a full set of adjacent polygons that functions as a stylized political
 * map without requiring hand-authored province boundary data. Cells are clipped to
 * the map bounds (with a small margin so edge provinces don't get oddly truncated).
 */
export function buildMapCells(provinces: Province[]): MapCell[] {
  const points: [number, number][] = provinces.map((p) => [p.x, p.y]);
  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi([-60, -60, MAP_WIDTH + 60, MAP_HEIGHT + 60]);

  return provinces.map((province, i) => {
    const cellPoints = voronoi.cellPolygon(i);
    const polygon: [number, number][] = cellPoints ? (cellPoints as [number, number][]) : [];
    return { province, polygon, centroid: [province.x, province.y] };
  });
}

export function polygonToPath(polygon: [number, number][]): string {
  if (polygon.length === 0) return '';
  return `M${polygon.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
}
