import type { Power } from '../map/provinces.js';
import type { Order, Unit } from '../engine/types.js';
import type { ApiOrder } from './apiTypes.js';

/** Converts API orders to engine orders, dropping/ignoring any that don't belong to
 * `power` or reference a unit that doesn't exist (defensive; the engine itself also
 * defaults illegal orders to hold). */
export function convertOrders(apiOrders: ApiOrder[], power: Power, units: Unit[]): Order[] {
  const ownUnits = new Set(units.filter((u) => u.power === power).map((u) => u.province));
  const out: Order[] = [];
  for (const o of apiOrders) {
    if (!ownUnits.has(o.province)) continue;
    switch (o.kind) {
      case 'hold':
        out.push({ kind: 'hold', unit: { province: o.province } });
        break;
      case 'move':
        if (!o.to) continue;
        out.push({ kind: 'move', unit: { province: o.province }, to: o.to, toCoast: o.toCoast });
        break;
      case 'support-hold':
        if (!o.targetProvince) continue;
        out.push({ kind: 'support-hold', unit: { province: o.province }, target: { province: o.targetProvince } });
        break;
      case 'support-move':
        if (!o.targetProvince || !o.to) continue;
        out.push({ kind: 'support-move', unit: { province: o.province }, target: { province: o.targetProvince }, to: o.to });
        break;
      case 'convoy':
        if (!o.armyProvince || !o.to) continue;
        out.push({ kind: 'convoy', unit: { province: o.province }, army: { province: o.armyProvince }, to: o.to });
        break;
    }
  }
  return out;
}
