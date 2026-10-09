import type { Power, Province } from '../types/domain';

/**
 * Assigns every land province to a power by multi-source breadth-first flood fill from
 * each power's currently-owned supply centers, walking the army adjacency graph. A
 * province reached by more than one power at the same distance is genuinely contested
 * border territory and is left unclaimed (neutral) rather than arbitrarily picking one.
 */
export function computeFloodFillOwners(provinces: Province[], supplyCenters: Record<string, Power>): Record<string, Power> {
  const byId: Record<string, Province> = Object.fromEntries(provinces.map((p) => [p.id, p]));
  const owner: Record<string, Power> = {};
  let frontier: Array<{ id: string; power: Power }> = [];

  for (const p of provinces) {
    if (p.type !== 'land') continue;
    const sc = supplyCenters[p.id];
    if (sc) {
      owner[p.id] = sc;
      frontier.push({ id: p.id, power: sc });
    }
  }

  while (frontier.length > 0) {
    const claims = new Map<string, Set<Power>>();
    for (const { id, power } of frontier) {
      const province = byId[id];
      if (!province) continue;
      for (const neighborId of province.armyAdjacent) {
        const neighbor = byId[neighborId];
        if (!neighbor || neighbor.type !== 'land' || owner[neighborId] !== undefined) continue;
        let set = claims.get(neighborId);
        if (!set) claims.set(neighborId, (set = new Set()));
        set.add(power);
      }
    }
    const next: Array<{ id: string; power: Power }> = [];
    for (const [id, powers] of claims) {
      if (powers.size !== 1) continue; // contested at this distance - stays neutral
      const power = [...powers][0];
      owner[id] = power;
      next.push({ id, power });
    }
    frontier = next;
  }

  return owner;
}
