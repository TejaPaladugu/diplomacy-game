import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const geo = JSON.parse(readFileSync(join(root, 'src/map/geometry.json'), 'utf8'));
const { width, height, worldLand, provinces } = geo;

function pathFrom(ring) {
  if (!ring.length) return '';
  return 'M' + ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';
}

const SEA_IDS = new Set([
  'nao', 'nwg', 'bar', 'nth', 'eng', 'iri', 'mao', 'wes', 'lyo', 'tys', 'ion', 'adr', 'aeg', 'eas', 'bla', 'bal', 'bot', 'ska', 'hel',
]);

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
svg += `<rect width="100%" height="100%" fill="#7fa8c9"/>`;
for (const [id, p] of Object.entries(provinces)) {
  const fill = SEA_IDS.has(id) ? '#a9cde0' : '#e8dcc0';
  svg += `<path d="${pathFrom(p.polygon)}" fill="${fill}" fill-opacity="0.85" stroke="#333" stroke-width="0.6"/>`;
}
for (const ring of worldLand) svg += `<path d="${pathFrom(ring)}" fill="none" stroke="#000" stroke-width="1.2"/>`;
for (const [id, p] of Object.entries(provinces)) {
  svg += `<circle cx="${p.x}" cy="${p.y}" r="2" fill="red"/>`;
  svg += `<text x="${p.x}" y="${p.y}" font-size="9">${id}</text>`;
}
svg += `</svg>`;

writeFileSync('/tmp/claude-0/-home-user/47b5898a-684d-5052-8119-9e9087683e3a/scratchpad/map-preview.svg', svg);
console.log('wrote svg');
