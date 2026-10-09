import { PROVINCES, type CoastId, type Province } from './provinces.js';
import type { Unit, UnitRef } from '../engine/types.js';

export function province(id: string): Province {
  const p = PROVINCES[id];
  if (!p) throw new Error(`Unknown province: ${id}`);
  return p;
}

export function armyAdjacent(from: string, to: string): boolean {
  return province(from).armyAdjacent.includes(to);
}

/** Can a fleet currently at `from` (optionally on a specific coast) move to `toRef`? */
export function fleetAdjacent(from: string, fromCoast: CoastId | undefined, toRef: UnitRef): boolean {
  const p = province(from);
  const coastKey = fromCoast ?? 'single';
  const list = p.fleetAdjacent[coastKey];
  if (!list) return false;
  const toP = province(toRef.province);
  if (toP.coasts) {
    // Target has split coasts: must match a specific coast entry.
    if (toRef.coast) return list.includes(`${toRef.province}:${toRef.coast}`);
    // No coast specified: legal only if exactly one coast is reachable (lenient inference).
    const matches = toP.coasts.filter((c) => list.includes(`${toRef.province}:${c}`));
    return matches.length >= 1;
  }
  return list.includes(toRef.province);
}

/** Resolve the (possibly unspecified) coast for a fleet move into a split-coast province. */
export function inferCoast(from: string, fromCoast: CoastId | undefined, toProvince: string, requestedCoast?: CoastId): CoastId | undefined {
  const toP = province(toProvince);
  if (!toP.coasts) return undefined;
  if (requestedCoast && toP.coasts.includes(requestedCoast)) return requestedCoast;
  const p = province(from);
  const list = p.fleetAdjacent[fromCoast ?? 'single'] ?? [];
  const matches = toP.coasts.filter((c) => list.includes(`${toProvince}:${c}`));
  return matches.length === 1 ? matches[0] : requestedCoast;
}

/** Can `unit` legally move to (or support into) `dest`, for support-legality purposes
 * (coast-insensitive, per the rule that a fleet with multiple coast options can support
 * without regard to which specific coast). */
export function canReach(unit: Unit, dest: string): boolean {
  if (unit.type === 'A') return armyAdjacent(unit.province, dest) && province(dest).type === 'land';
  const p = province(unit.province);
  const coastKey = unit.coast ?? 'single';
  const list = p.fleetAdjacent[coastKey] ?? [];
  return list.some((entry) => entry.split(':')[0] === dest);
}

export function isSeaProvince(id: string): boolean {
  return province(id).type === 'sea';
}

export function isCoastalLand(id: string): boolean {
  const p = province(id);
  return p.type === 'land' && p.coastal;
}

/**
 * All provinces reachable by fleet from `provinceId`, for convoy-chain purposes. For a
 * pure sea province this is its ordinary fleet adjacency. For a split-coast land
 * province (Spain, Bulgaria, St Petersburg) this is the union across both coasts,
 * since an Army boarding/landing there doesn't care which specific coast a fleet
 * occupies.
 */
export function seaNeighbors(provinceId: string): string[] {
  const p = province(provinceId);
  const keys = p.coasts ?? ['single' as const];
  const out = new Set<string>();
  for (const k of keys) {
    for (const entry of p.fleetAdjacent[k] ?? []) out.add(entry.split(':')[0]);
  }
  return [...out];
}

/** Valid retreat destinations for a dislodged unit: provinces it could normally move to,
 * minus any province occupied after the movement phase, minus the attacker's origin,
 * minus any province left vacant by a standoff this same turn. */
export function retreatOptions(
  unit: Unit,
  occupiedAfter: Set<string>,
  attackerFrom: string,
  standoffProvinces: Set<string>,
): string[] {
  const reachable =
    unit.type === 'A'
      ? province(unit.province).armyAdjacent.filter((id) => province(id).type === 'land')
      : Array.from(
          new Set((province(unit.province).fleetAdjacent[unit.coast ?? 'single'] ?? []).map((e) => e.split(':')[0])),
        );
  return reachable.filter((id) => id !== attackerFrom && !occupiedAfter.has(id) && !standoffProvinces.has(id));
}
