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

export const POWER_COLORS: Record<Power, string> = {
  AUSTRIA: '#d94f4f',
  ENGLAND: '#3a6ea5',
  FRANCE: '#5aa0d8',
  GERMANY: '#4a4a4a',
  ITALY: '#4a9c5d',
  RUSSIA: '#b8b8b8',
  TURKEY: '#d9b74a',
};
