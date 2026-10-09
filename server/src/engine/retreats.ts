import type { Dislodgement, RetreatOrder, RetreatResult, Unit } from './types.js';

/**
 * Resolves the Retreat and Disbanding phase. Each dislodged unit either retreats to
 * one of its precomputed legal options or disbands. If two or more units are ordered
 * to retreat to the same province, all of them are disbanded instead (per the
 * rulebook's "Disbandment" rule).
 */
export function resolveRetreats(survivors: Unit[], dislodgements: Dislodgement[], orders: RetreatOrder[]): RetreatResult {
  const orderByProvince = new Map(orders.map((o) => [o.unit.province, o]));
  const destinationCounts = new Map<string, number>();

  for (const d of dislodgements) {
    const order = orderByProvince.get(d.unit.province);
    const to = order?.to && d.retreatOptions.includes(order.to) ? order.to : null;
    if (to) destinationCounts.set(to, (destinationCounts.get(to) ?? 0) + 1);
  }

  const units: Unit[] = [...survivors];
  const disbanded: Unit[] = [];

  for (const d of dislodgements) {
    const order = orderByProvince.get(d.unit.province);
    const to = order?.to && d.retreatOptions.includes(order.to) ? order.to : null;
    if (!to || (destinationCounts.get(to) ?? 0) > 1) {
      disbanded.push(d.unit);
    } else {
      units.push({ ...d.unit, province: to, coast: order?.toCoast });
    }
  }

  return { units, disbanded };
}
