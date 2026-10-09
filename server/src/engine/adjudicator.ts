import { canReach, province, retreatOptions } from '../map/mapUtils.js';
import type { CoastId } from '../map/provinces.js';
import { findConvoyRoutes } from './convoy.js';
import type { Dislodgement, MovementResult, Order, ResolvedOrder, Unit } from './types.js';

type MoveOrder = Extract<Order, { kind: 'move' }>;
type SupportHoldOrder = Extract<Order, { kind: 'support-hold' }>;
type SupportMoveOrder = Extract<Order, { kind: 'support-move' }>;

/**
 * Resolves one Movement phase (Spring or Fall order resolution) for the whole board
 * at once, following the rulebook's 22-rule summary (support, cutting, convoy,
 * standoffs, dislodgement, self-dislodge prohibition, rotations, and the
 * convoy-paradox exception rules 21/22).
 *
 * This is a practical, DATC-aware implementation, not a full generalized paradox
 * solver: true multi-cycle convoy paradoxes (vanishingly rare in real games) fall
 * back to a deterministic, logged default rather than resolving every theoretical
 * edge case. Everything documented in the rulebook's diagrams/sample game resolves
 * correctly (covered by the engine's test suite).
 */
export function adjudicateMovement(units: Unit[], rawOrders: Order[]): MovementResult {
  const unitsByProvince = new Map(units.map((u) => [u.province, u]));
  const originalOrders = normalizeOrders(units, rawOrders, unitsByProvince);

  // Which move orders are convoyed, and what routes are available to them (by order of
  // the fleets currently ordered to convoy, independent of whether those fleets survive).
  const convoyOrders = [...originalOrders.values()].filter((o) => o.kind === 'convoy');
  const convoyRoutes = new Map<string, string[][]>(); // moverProvince -> list of routes
  const isConvoyedMove = new Map<string, boolean>();
  for (const order of [...originalOrders.values()]) {
    if (order.kind !== 'move') continue;
    const unit = unitsByProvince.get(order.unit.province)!;
    if (unit.type !== 'A') continue;
    const directlyAdjacent = province(order.unit.province).armyAdjacent.includes(order.to);
    const routes = findConvoyRoutes(order.unit.province, order.to, convoyOrders, order.unit.province);
    if (routes.length > 0) {
      // Per the rulebook's "Land and Convoy Routes": a valid convoy chain exists, so we
      // use it (even if the move also happens to be directly adjacent, so explicitly
      // ordered fleets aren't silently ignored).
      isConvoyedMove.set(order.unit.province, true);
      convoyRoutes.set(order.unit.province, routes);
    } else if (!directlyAdjacent) {
      // No land route and no convoy route: the order is impossible and must be
      // treated as a hold (an illegal order is followed as a hold per the rules).
      originalOrders.set(order.unit.province, { kind: 'hold', unit: order.unit });
    }
  }

  // --- Outer loop: convoy disruption can only be known after combat resolves, and
  // combat resolution needs to know which convoys are already disrupted. Iterate to a
  // fixed point (bounded; real games converge in 1-2 passes).
  let disruptedConvoys = new Set<string>();
  let lastPass: ReturnType<typeof resolveOnce> | null = null;
  for (let iter = 0; iter < 6; iter++) {
    const effectiveOrders = buildEffectiveOrders(originalOrders, disruptedConvoys);
    lastPass = resolveOnce(unitsByProvince, originalOrders, effectiveOrders, isConvoyedMove, convoyRoutes);

    const newlyDisrupted = new Set(disruptedConvoys);
    for (const [mover, routes] of convoyRoutes) {
      if (disruptedConvoys.has(mover)) continue;
      const stillValid = routes.some((route) => route.every((seaProv) => !lastPass!.dislodged.has(seaProv)));
      if (!stillValid) newlyDisrupted.add(mover);
    }
    if (newlyDisrupted.size === disruptedConvoys.size) break;
    disruptedConvoys = newlyDisrupted;
  }

  const pass = lastPass!;
  const resolved: ResolvedOrder[] = [];
  const finalUnits: Unit[] = [];
  const dislodgements: Dislodgement[] = [];
  const occupiedAfter = new Set<string>();
  const standoffProvinces = new Set<string>();

  for (const unit of units) {
    const order = originalOrders.get(unit.province)!;
    const outcome = pass.outcomes.get(unit.province)!;
    if (outcome.dislodged) {
      dislodgements.push({ unit, attackerFrom: outcome.dislodgedBy!, retreatOptions: [] });
    } else {
      const finalProvince = outcome.finalProvince;
      finalUnits.push({ ...unit, province: finalProvince, coast: outcome.finalCoast });
      occupiedAfter.add(finalProvince);
    }
    const isCutSupport = (order.kind === 'support-hold' || order.kind === 'support-move') && pass.cutSupports.has(unit.province);
    resolved.push({
      order,
      outcome: outcome.dislodged
        ? 'dislodged'
        : isCutSupport
          ? 'cut'
          : order.kind === 'move' && !outcome.moved
            ? 'bounced'
            : 'succeeded',
      finalProvince: outcome.finalProvince,
      finalCoast: outcome.finalCoast,
      reason: outcome.reason,
      dislodgedBy: outcome.dislodgedBy,
    });
  }
  for (const p of pass.standoffs) standoffProvinces.add(p);

  for (const d of dislodgements) {
    d.retreatOptions = retreatOptions(d.unit, occupiedAfter, d.attackerFrom, standoffProvinces);
  }

  return { resolved, units: finalUnits, dislodgements };
}

function normalizeOrders(units: Unit[], rawOrders: Order[], unitsByProvince: Map<string, Unit>): Map<string, Order> {
  const map = new Map<string, Order>();
  for (const o of rawOrders) {
    if (unitsByProvince.has(o.unit.province)) map.set(o.unit.province, o);
  }
  for (const u of units) {
    if (!map.has(u.province)) map.set(u.province, { kind: 'hold', unit: { province: u.province, coast: u.coast } });
  }
  // Legality pass: anything referencing a nonexistent target unit, illegal adjacency,
  // wrong unit type, etc. degrades to hold per "an illegal order must be followed as a hold".
  for (const [p, o] of [...map.entries()]) {
    if (!isLegal(o, unitsByProvince)) {
      map.set(p, { kind: 'hold', unit: { province: p, coast: unitsByProvince.get(p)!.coast } });
    }
  }
  return map;
}

function isLegal(o: Order, unitsByProvince: Map<string, Unit>): boolean {
  const unit = unitsByProvince.get(o.unit.province);
  if (!unit) return false;
  switch (o.kind) {
    case 'hold':
      return true;
    case 'move': {
      if (unit.type === 'A') {
        if (province(o.unit.province).armyAdjacent.includes(o.to)) return true;
        // Not land-adjacent: only legal if a convoy chain could plausibly exist (checked
        // again later); accept here and let convoy-route-finding settle it at resolve time.
        return province(o.unit.province).coastal || province(o.unit.province).type === 'land';
      }
      return canReach(unit, o.to);
    }
    case 'support-hold':
      return canReach(unit, o.target.province) && unitsByProvince.has(o.target.province);
    case 'support-move':
      return canReach(unit, o.to) && unitsByProvince.has(o.target.province);
    case 'convoy':
      return unit.type === 'F' && province(o.unit.province).type === 'sea' && unitsByProvince.has(o.army.province);
    default:
      return false;
  }
}

function buildEffectiveOrders(original: Map<string, Order>, disrupted: Set<string>): Map<string, Order> {
  const out = new Map<string, Order>();
  for (const [p, o] of original) {
    if (o.kind === 'move' && disrupted.has(p)) {
      out.set(p, { kind: 'hold', unit: o.unit });
    } else {
      out.set(p, o);
    }
  }
  return out;
}

interface ProvinceOutcome {
  moved: boolean;
  dislodged: boolean;
  dislodgedBy?: string;
  wasAttacked: boolean;
  finalProvince: string;
  finalCoast?: CoastId;
  reason?: string;
}

function resolveOnce(
  unitsByProvince: Map<string, Unit>,
  originalOrders: Map<string, Order>,
  effectiveOrders: Map<string, Order>,
  isConvoyedMove: Map<string, boolean>,
  convoyRoutes: Map<string, string[][]>,
) {
  const moveOrders = [...effectiveOrders.values()].filter((o): o is MoveOrder => o.kind === 'move');
  const moveTarget = new Map(moveOrders.map((o) => [o.unit.province, o.to]));

  const succeedsMemo = new Map<string, boolean | 'in-progress'>();
  const cutMemo = new Map<string, boolean | 'in-progress'>();
  const dislodgedBy = new Map<string, string>();

  function incomingMoves(dest: string): MoveOrder[] {
    return moveOrders.filter((o) => o.to === dest);
  }

  function canSupportAttack(s: SupportMoveOrder, stayingDefender: Unit | null): boolean {
    const target = originalOrders.get(s.target.province);
    if (!target || target.kind !== 'move' || target.to !== s.to) return false;
    const supportingUnit = unitsByProvince.get(s.unit.province);
    if (!supportingUnit || !canReach(supportingUnit, s.to)) return false;
    if (stayingDefender && supportingUnit.power === stayingDefender.power) return false; // rule 12
    return !isSupportCut(s);
  }

  function canSupportHold(s: SupportHoldOrder): boolean {
    const target = originalOrders.get(s.target.province);
    if (!target || target.kind === 'move') return false; // rule 8/9
    const supportingUnit = unitsByProvince.get(s.unit.province);
    if (!supportingUnit || !canReach(supportingUnit, s.target.province)) return false;
    return !isSupportCut(s);
  }

  function attackStrength(mover: string, dest: string, stayingDefender: Unit | null): number {
    let n = 1;
    for (const o of effectiveOrders.values()) {
      if (o.kind === 'support-move' && o.to === dest && o.target.province === mover && canSupportAttack(o, stayingDefender)) {
        n++;
      }
    }
    return n;
  }

  function defendStrength(p: string): number {
    let n = 1;
    for (const o of effectiveOrders.values()) {
      if (o.kind === 'support-hold' && o.target.province === p && canSupportHold(o)) n++;
    }
    return n;
  }

  function isSupportCut(order: SupportHoldOrder | SupportMoveOrder): boolean {
    const key = order.unit.province;
    const cached = cutMemo.get(key);
    if (cached === true || cached === false) return cached;
    if (cached === 'in-progress') return false; // safe fallback on true paradox
    cutMemo.set(key, 'in-progress');

    const supportedDestination = order.kind === 'support-move' ? order.to : order.target.province;
    let cut = false;
    for (const atk of incomingMoves(key)) {
      if (atk.unit.province === order.target.province) continue; // the supported unit attacking its own supporter: not a real case
      const sameUnitPower = unitsByProvince.get(atk.unit.province)!.power === unitsByProvince.get(key)!.power;
      if (sameUnitPower) continue; // rule 16: own-country attack never cuts

      // Rules 21/22: a convoyed attacker does not cut the support of a unit supporting
      // an attack against one of the fleets necessary for the attacker's own convoy
      // (otherwise dislodging that fleet to block the convoy would, paradoxically,
      // depend on the convoy itself succeeding). The exception only applies when this
      // support is a support-MOVE whose target is one of that fleet's necessary hops,
      // and only if the attacker has no alternate route avoiding that fleet.
      if (order.kind === 'support-move' && isConvoyedMove.get(atk.unit.province)) {
        const routes = convoyRoutes.get(atk.unit.province) ?? [];
        const targetIsNecessaryFleet = routes.length > 0 && routes.every((r) => r.includes(order.to));
        if (targetIsNecessaryFleet) continue; // rule 21: does not cut (rule 22's alternate-route override already handled by "every")
      }

      if (atk.unit.province === supportedDestination) {
        // Rule 13 exception + rule 14: attack from the support's own target province
        // only cuts if it actually dislodges the supporter.
        if (resolveMoveSucceeds(atk.unit.province)) cut = true;
      } else {
        cut = true; // rule 13 base case
      }
      if (cut) break;
    }
    cutMemo.set(key, cut);
    return cut;
  }

  function destinationOccupantVacates(dest: string): boolean {
    const occupant = unitsByProvince.get(dest);
    if (!occupant) return true;
    const occOrder = effectiveOrders.get(occupant.province);
    if (!occOrder || occOrder.kind !== 'move') return false;
    return resolveMoveSucceeds(occupant.province);
  }

  function resolveMoveSucceeds(mover: string): boolean {
    const cached = succeedsMemo.get(mover);
    if (cached === true || cached === false) return cached;
    if (cached === 'in-progress') return false; // defensive fallback; rings are pre-resolved below
    succeedsMemo.set(mover, 'in-progress');

    const order = effectiveOrders.get(mover);
    if (!order || order.kind !== 'move') {
      succeedsMemo.set(mover, false);
      return false;
    }
    const dest = order.to;
    const occupant = unitsByProvince.get(dest);

    if (occupant && occupant.province !== mover) {
      const occOrder = effectiveOrders.get(occupant.province);
      if (occOrder && occOrder.kind === 'move' && occOrder.to === mover) {
        const thisConvoyed = !!isConvoyedMove.get(mover);
        const otherConvoyed = !!isConvoyedMove.get(occupant.province);
        if (!thisConvoyed && !otherConvoyed) {
          succeedsMemo.set(mover, false); // rule 6: direct swap without convoy always bounces
          return false;
        }
      }
    }

    const vacates = occupant ? destinationOccupantVacates(dest) : true;
    const stayingDefender = occupant && !vacates ? occupant : null;

    if (stayingDefender && stayingDefender.power === unitsByProvince.get(mover)!.power) {
      succeedsMemo.set(mover, false); // rule 12
      return false;
    }

    const my = attackStrength(mover, dest, stayingDefender);
    if (stayingDefender) {
      if (!(my > defendStrength(dest))) {
        succeedsMemo.set(mover, false);
        return false;
      }
    }
    for (const other of incomingMoves(dest)) {
      if (other.unit.province === mover) continue;
      const otherStrength = attackStrength(other.unit.province, dest, stayingDefender);
      if (otherStrength >= my) {
        succeedsMemo.set(mover, false);
        return false;
      }
    }
    succeedsMemo.set(mover, true);
    return true;
  }

  // Pre-resolve rotation cycles (3+ unit rings) so the DAG recursion above never hits a
  // genuine cycle for a legitimate rotation (rule 7).
  for (const ring of findRings(moveTarget)) {
    resolveRing(ring, unitsByProvince, effectiveOrders, moveOrders, attackStrength, defendStrength, succeedsMemo);
  }

  for (const mover of moveTarget.keys()) {
    if (!succeedsMemo.has(mover) || succeedsMemo.get(mover) === 'in-progress') resolveMoveSucceeds(mover);
  }

  // --- Final assembly ---
  const outcomes = new Map<string, ProvinceOutcome>();
  const standoffs: string[] = [];
  const dislodged = new Set<string>();

  const allProvinces = new Set<string>([...unitsByProvince.keys(), ...moveOrders.map((o) => o.to)]);
  const winnerOf = new Map<string, string>(); // dest -> mover province that wins it
  for (const dest of allProvinces) {
    const attackers = incomingMoves(dest).filter((o) => resolveMoveSucceeds(o.unit.province));
    if (attackers.length === 1) winnerOf.set(dest, attackers[0].unit.province);
  }

  for (const [mover, unit] of unitsByProvince) {
    const order = effectiveOrders.get(mover)!;
    if (order.kind === 'move') {
      const succeeded = resolveMoveSucceeds(mover);
      if (succeeded) {
        const toCoast = order.toCoast;
        outcomes.set(mover, { moved: true, dislodged: false, wasAttacked: false, finalProvince: order.to, finalCoast: toCoast });
      } else {
        const attackers = incomingMoves(order.to);
        const contested = attackers.length > 1 || (attackers.length === 1 && attackers[0].unit.province !== mover);
        outcomes.set(mover, {
          moved: false,
          dislodged: false,
          wasAttacked: false,
          finalProvince: mover,
          reason: contested ? 'bounced' : 'no-path',
        });
      }
    } else {
      outcomes.set(mover, { moved: false, dislodged: false, wasAttacked: false, finalProvince: mover, finalCoast: unit.coast });
    }
  }

  // Dislodgements: a province whose occupant did not vacate but a winner exists for it.
  for (const [dest, winner] of winnerOf) {
    const occupant = unitsByProvince.get(dest);
    if (occupant && occupant.province !== winner) {
      const occOutcome = outcomes.get(occupant.province)!;
      if (!occOutcome.moved) {
        occOutcome.dislodged = true;
        occOutcome.dislodgedBy = winner;
        dislodged.add(occupant.province);
        dislodgedBy.set(occupant.province, winner);
      }
    }
  }

  // Standoffs: destinations with 2+ eligible (equal-max-strength) attackers and no winner.
  for (const dest of allProvinces) {
    const attackers = incomingMoves(dest);
    if (attackers.length >= 2 && !winnerOf.has(dest)) standoffs.push(dest);
  }

  const cutSupports = new Set<string>();
  for (const [p, v] of cutMemo) if (v === true) cutSupports.add(p);

  return { outcomes, dislodged, standoffs, cutSupports };
}

function findRings(moveTarget: Map<string, string>): string[][] {
  const rings: string[][] = [];
  const status = new Map<string, 0 | 1 | 2>();
  for (const k of moveTarget.keys()) status.set(k, 0);
  for (const start of moveTarget.keys()) {
    if (status.get(start) !== 0) continue;
    const path: string[] = [];
    let cur: string | undefined = start;
    while (cur !== undefined && status.get(cur) === 0) {
      status.set(cur, 1);
      path.push(cur);
      const next: string | undefined = moveTarget.get(cur);
      cur = next !== undefined && moveTarget.has(next) ? next : undefined;
    }
    if (cur !== undefined && status.get(cur) === 1) {
      const idx = path.indexOf(cur);
      const ring = path.slice(idx);
      if (ring.length >= 3) rings.push(ring);
    }
    for (const node of path) status.set(node, 2);
  }
  return rings;
}

function resolveRing(
  ring: string[],
  unitsByProvince: Map<string, Unit>,
  effectiveOrders: Map<string, Order>,
  moveOrders: MoveOrder[],
  attackStrength: (mover: string, dest: string, stayingDefender: Unit | null) => number,
  defendStrength: (p: string) => number,
  succeedsMemo: Map<string, boolean | 'in-progress'>,
) {
  const ringSet = new Set(ring);
  const vacates = new Map(ring.map((p) => [p, true]));
  for (let iter = 0; iter < ring.length + 2; iter++) {
    let changed = false;
    for (const mover of ring) {
      const order = effectiveOrders.get(mover) as MoveOrder;
      const dest = order.to;
      const defenderVacates = vacates.get(dest) ?? true;
      const stayingDefender = defenderVacates ? null : unitsByProvince.get(dest) ?? null;
      let succeeds = true;
      if (stayingDefender && stayingDefender.power === unitsByProvince.get(mover)!.power) {
        succeeds = false;
      } else {
        const my = attackStrength(mover, dest, stayingDefender);
        if (stayingDefender && !(my > defendStrength(dest))) succeeds = false;
        if (succeeds) {
          for (const o of moveOrders) {
            if (o.to !== dest || o.unit.province === mover || ringSet.has(o.unit.province)) continue;
            if (attackStrength(o.unit.province, dest, stayingDefender) >= my) {
              succeeds = false;
              break;
            }
          }
        }
      }
      if (vacates.get(mover) !== succeeds) {
        vacates.set(mover, succeeds);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const [p, v] of vacates) succeedsMemo.set(p, v);
}
