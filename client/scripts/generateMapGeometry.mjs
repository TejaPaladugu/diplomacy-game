// Build-time script: turns real-world coastline data (world-atlas, public-domain
// Natural Earth extract) into province shapes for the 75-province Diplomacy map.
// Run with: node scripts/generateMapGeometry.mjs
// Output: src/map/geometry.json (small, checked in; browser never touches the
// multi-MB source data or the heavy geo libraries used here).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as topojson from 'topojson-client';
import { geoConicEqualArea, geoPath } from 'd3-geo';
import { Delaunay } from 'd3-delaunay';
import * as turf from '@turf/turf';
import { PROVINCE_LONLAT } from './provinceCoords.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const WIDTH = 1200;
const HEIGHT = 900;
const BBOX = [-24, 33, 46, 73]; // lon/lat box covering the Diplomacy map's extent

const land110 = JSON.parse(readFileSync(join(root, 'node_modules/world-atlas/land-110m.json'), 'utf8'));
const landFeatureCollection = topojson.feature(land110, land110.objects.land);
const landGeo = landFeatureCollection.features[0]; // single MultiPolygon feature
const worldLand = turf.simplify(landGeo, { tolerance: 0.02, highQuality: false });

const projection = geoConicEqualArea().parallels([35, 65]).rotate([-14, 0]).center([0, 52]);
// Fit the projection to the actual spread of our province coordinates (a crude 4-corner
// bbox rectangle distorts unpredictably under a conic projection and badly underfits).
const pointsFeature = {
  type: 'MultiPoint',
  coordinates: [...Object.values(PROVINCE_LONLAT), [BBOX[0], BBOX[1]], [BBOX[2], BBOX[3]], [BBOX[0], BBOX[3]], [BBOX[2], BBOX[1]]],
};
projection.fitExtent(
  [
    [40, 40],
    [WIDTH - 40, HEIGHT - 40],
  ],
  pointsFeature,
);
const path = geoPath(projection);

function project([lon, lat]) {
  const p = projection([lon, lat]);
  return p ?? [0, 0];
}

// Reproject the simplified world landmass into our pixel space, clipped to the bbox.
const clippedLand = turf.bboxClip(worldLand, BBOX);
const landPixelRings = [];
for (const feature of clippedLand.features ?? [clippedLand]) {
  const geom = feature.geometry;
  if (!geom) continue;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  for (const poly of polys) {
    if (!poly || poly.length === 0 || !poly[0] || poly[0].length < 4) continue;
    const ring = poly[0].map(project);
    if (ring.length >= 4) landPixelRings.push(ring);
  }
}

// Build a turf MultiPolygon of the (pixel-space) landmass for clipping provinces.
const landPixelMulti = turf.multiPolygon(landPixelRings.map((ring) => [closeRing(ring)]));
let landUnion = landPixelMulti;
try {
  const dissolved = turf.union(turf.featureCollection(landPixelRings.map((ring) => turf.polygon([closeRing(ring)]))));
  if (dissolved) landUnion = dissolved;
} catch {
  // fall back to the multi-polygon as-is if union fails on messy geometry
}

function closeRing(ring) {
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) return [...ring, ring[0]];
  return ring;
}

const ids = Object.keys(PROVINCE_LONLAT);
const points = ids.map((id) => project(PROVINCE_LONLAT[id]));
const bboxCorners = [
  [0, 0],
  [WIDTH, 0],
  [WIDTH, HEIGHT],
  [0, HEIGHT],
];
const delaunay = Delaunay.from(points);
const PAD = 60;
const voronoi = delaunay.voronoi([-PAD, -PAD, WIDTH + PAD, HEIGHT + PAD]);

// Which provinces are "land" vs "sea" per the game's own map data (duplicated minimal
// list here; kept in sync by eye since this script only runs occasionally).
const SEA_IDS = new Set([
  'nao', 'nwg', 'bar', 'nth', 'eng', 'iri', 'mao', 'wes', 'lyo', 'tys', 'ion', 'adr', 'aeg', 'eas', 'bla', 'bal', 'bot', 'ska', 'hel',
]);

const provinces = {};
for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  const cellPts = voronoi.cellPolygon(i);
  if (!cellPts) {
    provinces[id] = { x: points[i][0], y: points[i][1], polygon: [] };
    continue;
  }
  const cellRing = closeRing(cellPts);
  let resultRings = [cellRing];
  try {
    const cellPoly = turf.polygon([cellRing]);
    if (SEA_IDS.has(id)) {
      const diff = turf.difference(turf.featureCollection([cellPoly, landUnion]));
      resultRings = ringsFromFeature(diff) ?? [cellRing];
    } else {
      const inter = turf.intersect(turf.featureCollection([cellPoly, landUnion]));
      resultRings = ringsFromFeature(inter) ?? [cellRing];
    }
  } catch (e) {
    console.error(`clip failed for ${id}: ${e.message}`);
    resultRings = [cellRing];
  }
  // Keep the largest ring (clipping can produce slivers for coastal cells).
  const biggest = resultRings.reduce((a, b) => (ringArea(b) > ringArea(a) ? b : a), resultRings[0]);
  provinces[id] = { x: points[i][0], y: points[i][1], polygon: biggest.slice(0, -1) };
}

function ringsFromFeature(feature) {
  if (!feature) return null;
  const geoms = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return geoms.map((poly) => poly[0]);
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(area / 2);
}

const output = {
  width: WIDTH,
  height: HEIGHT,
  worldLand: landPixelRings,
  provinces,
};

writeFileSync(join(root, 'src/map/geometry.json'), JSON.stringify(output));
console.log(`Wrote geometry for ${ids.length} provinces (${landPixelRings.length} world landmass rings).`);
