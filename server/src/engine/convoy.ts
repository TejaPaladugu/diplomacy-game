import { seaNeighbors, province } from '../map/mapUtils.js';
import type { Order } from './types.js';

/**
 * Given an army move order (origin -> dest) and the set of convoy orders issued this
 * turn (by anyone), find every simple chain of ordered, convoy-capable fleets that
 * could carry the army from origin to dest. A route is a list of sea-province ids.
 * Only fleets whose convoy order names this exact army+destination are usable.
 */
export function findConvoyRoutes(origin: string, dest: string, convoyOrders: Order[], armyProvince: string): string[][] {
  const relevantFleets = new Set(
    convoyOrders
      .filter((o): o is Extract<Order, { kind: 'convoy' }> => o.kind === 'convoy')
      .filter((o) => o.army.province === armyProvince && o.to === dest)
      .map((o) => o.unit.province),
  );
  if (relevantFleets.size === 0) return [];

  const originSeas = seaNeighbors(origin).filter((s) => relevantFleets.has(s));
  const destSeas = new Set(seaNeighbors(dest));

  const routes: string[][] = [];
  const visit = (current: string, path: string[]) => {
    if (path.length > 8) return; // guard against pathological cycles
    if (destSeas.has(current)) routes.push([...path]);
    for (const next of seaNeighbors(current)) {
      if (relevantFleets.has(next) && !path.includes(next)) {
        visit(next, [...path, next]);
      }
    }
  };
  for (const s of originSeas) {
    if (province(dest).type !== 'land') continue;
    visit(s, [s]);
  }
  return routes;
}

export function hasAnyConvoyPath(origin: string, dest: string, convoyOrders: Order[], armyProvince: string): boolean {
  return findConvoyRoutes(origin, dest, convoyOrders, armyProvince).length > 0;
}
