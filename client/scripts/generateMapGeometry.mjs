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
import { PNG } from 'pngjs';
import { PROVINCE_LONLAT } from './provinceCoords.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const WIDTH = 1200;
const HEIGHT = 900;
const BBOX = [-24, 33, 46, 73]; // lon/lat box covering the Diplomacy map's extent

// Use the highest-resolution coastline data (1:10m). We clip to our small bounding box
// *before* simplifying, so we keep full detail where it matters (this regional window)
// without the output ballooning in size - unlike simplifying the whole world first, which
// is what made the coastline look blocky despite starting from real geometry.
const land10 = JSON.parse(readFileSync(join(root, 'node_modules/world-atlas/land-10m.json'), 'utf8'));
const landFeatureCollection = topojson.feature(land10, land10.objects.land);
const landGeo = landFeatureCollection.features[0]; // single MultiPolygon feature
const landClippedToBbox = turf.bboxClip(landGeo, BBOX);
const worldLand = turf.simplify(landClippedToBbox, { tolerance: 0.015, highQuality: true });

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

function unproject([x, y]) {
  return projection.invert ? (projection.invert([x, y]) ?? [0, 0]) : [0, 0];
}

// Real elevation data (public-domain NASA/NOAA-derived relief, via the `three-globe`
// package's bundled example texture - copied once into scripts/data/, not an npm
// dependency we keep installed) rather than the previous curated mountain/forest list.
// A 2048x1024 equirectangular grayscale image: 0 = sea level or below, rising with
// brightness toward the highest peaks on Earth.
const topoPng = PNG.sync.read(readFileSync(join(__dirname, 'data/earth-topology.png')));
function elevationGray(lon, lat) {
  const px = Math.floor(((lon + 180) / 360) * topoPng.width) % topoPng.width;
  const py = Math.max(0, Math.min(topoPng.height - 1, Math.floor(((90 - lat) / 180) * topoPng.height)));
  const idx = (topoPng.width * py + ((px + topoPng.width) % topoPng.width)) << 2;
  return topoPng.data[idx];
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
    if (ring.length < 4 || ringArea(closeRing(ring)) <= 1.5) continue; // too small to register
    if (isBboxClipArtifact(ring)) continue;
    landPixelRings.push(ring);
  }
}

// turf.bboxClip occasionally traces a thin sliver along the clip boundary itself when a
// complex polygon (the whole world's landmass, here) grazes the edge of our bbox near the
// pole - a near-straight, very low-vertex-count ring spanning a wide x range but only a
// handful of pixels tall. Real simplified coastline fragments at this scale don't look
// like that, so treat the combination as a clipping artifact rather than real land.
function isBboxClipArtifact(ring) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const w = maxX - minX, h = maxY - minY;
  return ring.length <= 8 && w > 150 && h > 0 && w / h > 8;
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

// Raw Voronoi cell edges (the straight lines between province seed points, as opposed to
// coastline-derived segments) are long, perfectly straight lines - the source of the
// "blocky" look even after the coastline itself got more detailed. Give them the same
// gently wavy, hand-drawn-map character as a real coastline via fractal midpoint
// displacement, applied identically from both sides of a shared border (keyed off the
// edge's own endpoints, not which province or winding direction is processing it) so
// adjacent provinces' borders still mate exactly with no gaps or overlaps.
const DISPLACE_DEPTH = 5;
const DISPLACE_ROUGHNESS = 0.16;
const DISPLACE_MIN_SEGMENT = 5; // px - below this, treat as already-detailed coastline

function hash01(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

// The displaced midpoint of segment (a,b), independent of call order - always computed
// from the same canonically-sorted endpoint pair so both neighboring provinces agree.
function canonicalMidpoint(a, b, roughness) {
  const swap = a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
  const p0 = swap ? b : a;
  const p1 = swap ? a : b;
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy);
  const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
  if (len < 1e-9) return [mx, my];
  const nx = -dy / len, ny = dx / len; // unit perpendicular, derived from the canonical direction
  const r = hash01(p0[0] * 0.137 + p1[0] * 0.071, p0[1] * 0.091 + p1[1] * 0.233) * 2 - 1;
  const mag = len * roughness * r;
  return [mx + nx * mag, my + ny * mag];
}

function midpointDisplace(p0, p1, depth, roughness, out) {
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if (depth <= 0 || len < DISPLACE_MIN_SEGMENT) {
    out.push(p1);
    return;
  }
  const mid = canonicalMidpoint(p0, p1, roughness);
  midpointDisplace(p0, mid, depth - 1, roughness * 0.55, out);
  midpointDisplace(mid, p1, depth - 1, roughness * 0.55, out);
}

function organicizeRing(ring) {
  if (ring.length < 3) return ring;
  const out = [ring[0]];
  for (let i = 0; i < ring.length; i++) {
    midpointDisplace(ring[i], ring[(i + 1) % ring.length], DISPLACE_DEPTH, DISPLACE_ROUGHNESS, out);
  }
  out.pop(); // last pushed point duplicates out[0] (the ring closes back to its start)
  return out;
}

const provinces = {};
const rawElevations = {}; // id -> { seed: gray, verts: gray[] }, normalized after the loop
let grayMin = Infinity;
let grayMax = -Infinity;

for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  const cellPts = voronoi.cellPolygon(i);
  if (!cellPts) {
    provinces[id] = { x: points[i][0], y: points[i][1], polygon: [], radius: 0 };
    continue;
  }
  const cellRing = closeRing(cellPts);
  // Constrain the raw Voronoi cell to the canvas *before* clipping against the coastline -
  // cells near the map's edge (e.g. the Norwegian Sea, with no neighboring seed to its
  // north) otherwise balloon into huge slivers across the padded off-canvas margin, and
  // "difference against land" leaves most of that sliver intact since there's little land
  // way up there to subtract.
  const onCanvasFallback = clipRingToCanvas(cellRing) ?? cellRing;
  let resultRings = [onCanvasFallback];
  try {
    // Reducing coordinate precision first avoids the floating-point edge cases that
    // otherwise make turf's boolean ops throw on the now much more detailed coastline.
    const cellPoly = turf.truncate(turf.polygon([onCanvasFallback]), { precision: 6, mutate: false });
    const land = turf.truncate(landUnion, { precision: 6, mutate: false });
    if (SEA_IDS.has(id)) {
      const diff = turf.difference(turf.featureCollection([cellPoly, land]));
      resultRings = ringsFromFeature(diff) ?? [onCanvasFallback];
    } else {
      const inter = turf.intersect(turf.featureCollection([cellPoly, land]));
      resultRings = ringsFromFeature(inter) ?? [onCanvasFallback];
    }
  } catch (e) {
    console.error(`clip failed for ${id}: ${e.message}`);
    resultRings = [onCanvasFallback];
  }
  // Keep the largest ring (clipping can produce slivers for coastal cells).
  const biggest = resultRings.reduce((a, b) => (ringArea(b) > ringArea(a) ? b : a), resultRings[0]);
  // Approximate on-screen "size" of this province, used client-side to fade in its label
  // only once zoomed in enough that it has room (small provinces stay hidden until then).
  const radius = Math.sqrt(ringArea(biggest) / Math.PI);
  const polygon = organicizeRing(biggest.slice(0, -1));
  provinces[id] = { x: points[i][0], y: points[i][1], polygon, radius };

  // Real elevation, sampled per vertex (not just once per province), so the terrain mesh
  // can actually undulate across a province instead of sitting at one flat block height.
  if (!SEA_IDS.has(id)) {
    const [seedLon, seedLat] = PROVINCE_LONLAT[id];
    const seedGray = elevationGray(seedLon, seedLat);
    const vertGrays = polygon.map(([x, y]) => {
      const [lon, lat] = unproject([x, y]);
      return elevationGray(lon, lat);
    });
    rawElevations[id] = { seed: seedGray, verts: vertGrays };
    grayMin = Math.min(grayMin, seedGray, ...vertGrays);
    grayMax = Math.max(grayMax, seedGray, ...vertGrays);
  }
}

// Stretch this region's actual (modest, compared to Everest/the Mariana Trench) relief
// range across a visually meaningful world-unit height band, rather than using the raw
// global 0-255 scale under which all of Europe would barely register.
const ELEV_BASE = 0.3;
const ELEV_RANGE = 2.3;
function toWorldHeight(gray) {
  if (grayMax <= grayMin) return ELEV_BASE;
  const t = Math.max(0, Math.min(1, (gray - grayMin) / (grayMax - grayMin)));
  return ELEV_BASE + t * ELEV_RANGE;
}
for (const id of Object.keys(rawElevations)) {
  const { seed, verts } = rawElevations[id];
  provinces[id].elevation = toWorldHeight(seed);
  provinces[id].vertexElevations = verts.map(toWorldHeight);
}

function clipRingToCanvas(ring) {
  try {
    const clipped = turf.bboxClip(turf.polygon([ring]), [0, 0, WIDTH, HEIGHT]);
    return ringsFromFeature(clipped)?.[0] ? closeRing(ringsFromFeature(clipped)[0]) : null;
  } catch {
    return null;
  }
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
