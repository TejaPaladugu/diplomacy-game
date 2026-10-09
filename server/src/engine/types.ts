import type { CoastId, Power } from '../map/provinces.js';

export type UnitType = 'A' | 'F';

export interface Unit {
  type: UnitType;
  power: Power;
  province: string; // base province id (no coast suffix)
  coast?: CoastId; // only set for units sitting in a split-coast province
}

export interface UnitRef {
  province: string;
  coast?: CoastId;
}

export type Order =
  | { kind: 'hold'; unit: UnitRef }
  | { kind: 'move'; unit: UnitRef; to: string; toCoast?: CoastId }
  | { kind: 'support-hold'; unit: UnitRef; target: UnitRef }
  | { kind: 'support-move'; unit: UnitRef; target: UnitRef; to: string }
  | { kind: 'convoy'; unit: UnitRef; army: UnitRef; to: string };

export type OrderOutcome = 'succeeded' | 'bounced' | 'dislodged' | 'invalid' | 'cut' | 'no-convoy-path';

export interface ResolvedOrder {
  order: Order;
  outcome: OrderOutcome;
  /** For moves: the province the unit actually ends up in after this phase. */
  finalProvince: string;
  finalCoast?: CoastId;
  /** Human-readable reason, useful for UI / rewind explanations. */
  reason?: string;
  /** Province(s) whose attack caused a dislodgement/bounce, for arrow rendering. */
  dislodgedBy?: string;
}

export interface Dislodgement {
  unit: Unit;
  attackerFrom: string;
  /** Provinces this unit could legally retreat to (computed by the adjudicator). */
  retreatOptions: string[];
}

export interface MovementResult {
  resolved: ResolvedOrder[];
  units: Unit[]; // board state after this phase (dislodged units removed)
  dislodgements: Dislodgement[];
}

export interface RetreatOrder {
  unit: UnitRef;
  to: string | null; // null = disband
  toCoast?: CoastId;
}

export interface RetreatResult {
  units: Unit[];
  disbanded: Unit[];
}

export type AdjustmentOrder =
  | { kind: 'build'; power: Power; province: string; unitType: UnitType; coast?: CoastId }
  | { kind: 'disband'; power: Power; province: string };

export interface AdjustmentResult {
  units: Unit[];
  builds: AdjustmentOrder[];
  disbands: AdjustmentOrder[];
}
