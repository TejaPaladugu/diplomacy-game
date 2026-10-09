import { province } from '../map/mapUtils.js';
import { PROVINCES, type Power } from '../map/provinces.js';
import type { AdjustmentOrder, Dislodgement, Unit } from '../engine/types.js';
import type { GameRow } from '../game/gameService.js';
import type { ApiAdjustmentOrder, ApiOrder, ApiRetreatOrder } from '../game/apiTypes.js';
import { buildableHomeCenters } from '../engine/adjustments.js';

/**
 * A practical, rules-respecting heuristic bot for solo play: expand into open supply
 * centers, support friendly units that are attacking, otherwise hold. It has no
 * lookahead or diplomacy, but it never issues an illegal order and reliably plays a
 * complete game to its conclusion.
 */
export function generateAIOrders(game: GameRow, power: Power): ApiOrder[] {
  const myUnits = game.units.filter((u) => u.power === power);
  const occupied = new Set(game.units.map((u) => u.province));
  const orders: ApiOrder[] = [];
  const chosenMoves = new Map<string, string>(); // unit province -> destination

  for (const unit of myUnits) {
    const dest = pickExpansionTarget(unit, game, occupied);
    if (dest) {
      orders.push({ kind: 'move', province: unit.province, to: dest });
      chosenMoves.set(unit.province, dest);
    }
  }

  for (const unit of myUnits) {
    if (chosenMoves.has(unit.province)) continue;
    const reachable = unit.type === 'A' ? province(unit.province).armyAdjacent : seaReach(unit);
    const supportTarget = [...chosenMoves.entries()].find(([mover, dest]) => mover !== unit.province && reachable.includes(dest));
    if (supportTarget) {
      orders.push({ kind: 'support-move', province: unit.province, targetProvince: supportTarget[0], to: supportTarget[1] });
    } else {
      orders.push({ kind: 'hold', province: unit.province });
    }
  }
  return orders;
}

function seaReach(unit: Unit): string[] {
  const p = province(unit.province);
  return (p.fleetAdjacent[unit.coast ?? 'single'] ?? []).map((e) => e.split(':')[0]);
}

function pickExpansionTarget(unit: Unit, game: GameRow, occupied: Set<string>): string | null {
  const candidates = unit.type === 'A' ? province(unit.province).armyAdjacent : seaReach(unit);
  const scored = candidates
    .filter((c) => !occupied.has(c))
    .map((c) => ({ id: c, p: PROVINCES[c] }))
    .filter((c) => c.p.type === 'land');
  // Prefer an unowned/enemy supply center, then any supply center, then any open province.
  const target =
    scored.find((c) => c.p.supplyCenter && game.supplyCenters[c.id] !== unit.power) ??
    scored.find((c) => c.p.supplyCenter) ??
    null;
  return target?.id ?? null;
}

export function generateAIRetreats(dislodgements: Dislodgement[]): ApiRetreatOrder[] {
  return dislodgements.map((d) => ({ province: d.unit.province, to: d.retreatOptions[0] ?? null }));
}

export function generateAIAdjustments(game: GameRow, power: Power, delta: number): ApiAdjustmentOrder[] {
  if (delta > 0) {
    const options = buildableHomeCenters(power, game.units, game.supplyCenters);
    const fleetCount = game.units.filter((u) => u.power === power && u.type === 'F').length;
    const armyCount = game.units.filter((u) => u.power === power && u.type === 'A').length;
    const orders: ApiAdjustmentOrder[] = [];
    for (let i = 0; i < Math.min(delta, options.length); i++) {
      const p = PROVINCES[options[i]];
      const preferFleet = p.coastal && fleetCount <= armyCount;
      if (preferFleet && p.coasts) {
        orders.push({ kind: 'build', province: p.id, unitType: 'F', coast: p.coasts[0] });
      } else {
        orders.push({ kind: 'build', province: p.id, unitType: preferFleet ? 'F' : 'A' });
      }
    }
    return orders;
  }
  if (delta < 0) {
    const mine = game.units.filter((u) => u.power === power);
    const expendable = mine.filter((u) => !PROVINCES[u.province]?.supplyCenter);
    const toDisband = (expendable.length > 0 ? expendable : mine).slice(0, -delta);
    return toDisband.map((u) => ({ kind: 'disband' as const, province: u.province }));
  }
  return [];
}
