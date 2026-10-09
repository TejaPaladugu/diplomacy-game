export type Power = 'ENGLAND' | 'FRANCE' | 'GERMANY' | 'ITALY' | 'AUSTRIA' | 'RUSSIA' | 'TURKEY';
export const POWERS: Power[] = ['ENGLAND', 'FRANCE', 'GERMANY', 'ITALY', 'AUSTRIA', 'RUSSIA', 'TURKEY'];

export type CoastId = 'nc' | 'sc' | 'ec';
export type UnitType = 'A' | 'F';
export type Season = 'SPRING' | 'FALL';
export type Phase = 'orders' | 'retreat' | 'adjustment';

export interface Province {
  id: string;
  name: string;
  type: 'land' | 'sea';
  supplyCenter: boolean;
  home?: Power;
  coastal: boolean;
  coasts?: CoastId[];
  armyAdjacent: string[];
  fleetAdjacent: Record<string, string[]>;
  x: number;
  y: number;
}

export interface Unit {
  type: UnitType;
  power: Power;
  province: string;
  coast?: CoastId;
}

export interface Dislodgement {
  unit: Unit;
  attackerFrom: string;
  retreatOptions: string[];
}

export interface ResolvedOrder {
  order: ApiOrderEnvelope;
  outcome: 'succeeded' | 'bounced' | 'dislodged' | 'invalid' | 'cut' | 'no-convoy-path';
  finalProvince: string;
  finalCoast?: CoastId;
  reason?: string;
  dislodgedBy?: string;
}

export interface ApiOrderEnvelope {
  kind: string;
  unit: { province: string; coast?: CoastId };
  to?: string;
  toCoast?: CoastId;
  target?: { province: string };
  army?: { province: string };
}

export interface MovementResult {
  resolved: ResolvedOrder[];
  units: Unit[];
  dislodgements: Dislodgement[];
}

export interface GameState {
  id: string;
  name: string;
  mode: 'solo' | 'multiplayer';
  status: 'active' | 'completed';
  season: Season;
  year: number;
  phase: Phase;
  deadlineMinutes: number | null;
  deadlineAt: string | null;
  units: Unit[];
  supplyCenters: Record<string, Power>;
  pendingDislodgements: Dislodgement[];
  winner: Power | null;
  createdAt: string;
}

export interface PlayerInfo {
  power: Power;
  name: string;
  isAI: boolean;
  civilDisorder: boolean;
  eliminated: boolean;
}

export interface TurnHistoryEntry {
  turnIndex: number;
  season: Season;
  year: number;
  phase: Phase;
  unitsBefore: Unit[];
  orders: ApiOrderEnvelope[];
  resolved: ResolvedOrder[];
  unitsAfter: Unit[];
  supplyCentersAfter: Record<string, Power>;
  dislodgements: Dislodgement[];
  resolvedAt: string;
}

export type StatsSeries = Record<Power, Array<{ turnIndex: number; season: Season; year: number; supplyCenters: number; units: number }>>;

// Matched to the classic hand-drawn Diplomacy map palette (parchment, muted sage seas,
// each power a distinct dusty tone) rather than bright UI colors.
export const POWER_COLORS: Record<Power, string> = {
  AUSTRIA: '#cf8c6c',
  ENGLAND: '#8a97a8',
  FRANCE: '#a7cac1',
  GERMANY: '#a89881',
  ITALY: '#9ca55c',
  RUSSIA: '#e8e1cc',
  TURKEY: '#ddb15c',
};
