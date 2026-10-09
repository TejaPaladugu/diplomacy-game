import type { CoastId, Power } from '../map/provinces.js';

export type Season = 'SPRING' | 'FALL';
export type Phase = 'orders' | 'retreat' | 'adjustment';

export interface ApiOrder {
  kind: 'hold' | 'move' | 'support-hold' | 'support-move' | 'convoy';
  province: string;
  to?: string;
  toCoast?: CoastId;
  targetProvince?: string;
  armyProvince?: string;
}

export interface ApiRetreatOrder {
  province: string;
  to: string | null;
  toCoast?: CoastId;
}

export interface ApiAdjustmentOrder {
  kind: 'build' | 'disband';
  province: string;
  unitType?: 'A' | 'F';
  coast?: CoastId;
}

export interface CreateGameRequest {
  name: string;
  mode: 'solo' | 'multiplayer';
  players: Partial<Record<Power, { name: string; isAI: boolean }>>;
  deadlineMinutes?: number;
}
