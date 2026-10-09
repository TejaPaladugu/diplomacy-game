import { province } from '../map/mapUtils.js';
import { PROVINCES, type Power } from '../map/provinces.js';
import type { AdjustmentOrder, AdjustmentResult, Unit } from './types.js';

/** Positive = may build up to this many units; negative = must disband this many. */
export function computeAdjustmentCounts(units: Unit[], supplyCenterOwner: Map<string, Power>): Map<Power, number> {
  const scCount = new Map<Power, number>();
  for (const owner of supplyCenterOwner.values()) scCount.set(owner, (scCount.get(owner) ?? 0) + 1);
  const unitCount = new Map<Power, number>();
  for (const u of units) unitCount.set(u.power, (unitCount.get(u.power) ?? 0) + 1);

  const result = new Map<Power, number>();
  const powers = new Set<Power>([...scCount.keys(), ...unitCount.keys()]);
  for (const p of powers) {
    result.set(p, (scCount.get(p) ?? 0) - (unitCount.get(p) ?? 0));
  }
  return result;
}

export function buildableHomeCenters(power: Power, units: Unit[], supplyCenterOwner: Map<string, Power>): string[] {
  const occupied = new Set(units.map((u) => u.province));
  return Object.values(PROVINCES)
    .filter((p) => p.home === power && supplyCenterOwner.get(p.id) === power && !occupied.has(p.id))
    .map((p) => p.id);
}

/**
 * Applies a set of build/disband orders. Builds are validated (must target an
 * unoccupied, power-controlled home center; inland centers accept armies only);
 * invalid or excess builds are simply skipped. Disbands remove the named unit if it
 * belongs to the ordering power.
 */
export function applyAdjustments(units: Unit[], orders: AdjustmentOrder[], supplyCenterOwner: Map<string, Power>): AdjustmentResult {
  let current = [...units];
  const applied: AdjustmentOrder[] = [];
  const skipped: AdjustmentOrder[] = [];

  for (const o of orders) {
    if (o.kind === 'disband') {
      const idx = current.findIndex((u) => u.province === o.province && u.power === o.power);
      if (idx === -1) {
        skipped.push(o);
        continue;
      }
      current.splice(idx, 1);
      applied.push(o);
    } else {
      const p = province(o.province);
      const occupied = current.some((u) => u.province === o.province);
      const ownsIt = supplyCenterOwner.get(o.province) === o.power;
      const isHome = p.home === o.power;
      const typeOk = p.coastal || o.unitType === 'A';
      const coastOk = !p.coasts || (o.unitType === 'F' ? !!o.coast && p.coasts.includes(o.coast) : true);
      if (occupied || !ownsIt || !isHome || !typeOk || !coastOk) {
        skipped.push(o);
        continue;
      }
      current.push({ type: o.unitType, power: o.power, province: o.province, coast: o.unitType === 'F' ? o.coast : undefined });
      applied.push(o);
    }
  }

  return { units: current, builds: applied.filter((o) => o.kind === 'build'), disbands: applied.filter((o) => o.kind === 'disband') };
}
