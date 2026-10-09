import { create } from 'zustand';
import type { GameState, PlayerInfo, Power, Province, Unit } from '../types/domain';
import type { MapCell } from '../map/voronoi';
import { buildMapCells } from '../map/voronoi';

export type DraftOrderKind = 'hold' | 'move' | 'support-hold' | 'support-move' | 'convoy';

export interface DraftOrder {
  kind: DraftOrderKind;
  province: string;
  to?: string;
  targetProvince?: string;
  armyProvince?: string;
}

export type ViewMode = 'top-down' | 'orthographic' | 'perspective';
export type TerrainMode = 'flat' | 'relief';
export type PendingAction = 'move' | 'support' | 'convoy' | null;
/** 'ownership' colors supply centers by their owner (plus a lighter tint for provinces a
 * power's unit merely occupies); 'territory' flood-fills whole contiguous regions from
 * each power's supply centers for a painted-conquest-map look. */
export type TerritoryColorMode = 'ownership' | 'territory';

interface GameStoreState {
  provinces: Province[];
  cells: MapCell[];
  byId: Record<string, Province>;
  game: GameState | null;
  players: PlayerInfo[];
  myPower: Power | null;
  draftOrders: Record<string, DraftOrder>;
  selectedUnit: string | null;
  pendingAction: PendingAction;
  supportStage: 'pick-target' | 'pick-destination' | null;
  supportTargetProvince: string | null;
  viewMode: ViewMode;
  terrainMode: TerrainMode;
  territoryColorMode: TerritoryColorMode;
  highlightMineOnly: boolean;
  activePanel: 'orders' | 'rules' | 'stats' | 'rewind' | 'hypothetical' | null;
  hypotheticalDrafts: Record<string, DraftOrder>;

  setProvinces: (p: Province[]) => void;
  setGame: (g: GameState | null) => void;
  setPlayers: (p: PlayerInfo[]) => void;
  setMyPower: (p: Power | null) => void;
  selectUnit: (province: string | null) => void;
  setPendingAction: (a: PendingAction) => void;
  handleProvinceClick: (province: string) => void;
  clearDraftFor: (province: string) => void;
  clearAllDrafts: () => void;
  setViewMode: (v: ViewMode) => void;
  setTerrainMode: (t: TerrainMode) => void;
  setTerritoryColorMode: (m: TerritoryColorMode) => void;
  setHighlightMineOnly: (v: boolean) => void;
  setActivePanel: (p: GameStoreState['activePanel']) => void;
  myUnits: () => Unit[];
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  provinces: [],
  cells: [],
  byId: {},
  game: null,
  players: [],
  myPower: (localStorage.getItem('diplomacy.myPower') as Power | null) ?? null,
  draftOrders: {},
  selectedUnit: null,
  pendingAction: null,
  supportStage: null,
  supportTargetProvince: null,
  viewMode: 'top-down',
  terrainMode: 'relief',
  territoryColorMode: 'ownership',
  highlightMineOnly: false,
  activePanel: 'orders',
  hypotheticalDrafts: {},

  setProvinces: (p) => set({ provinces: p, cells: buildMapCells(p), byId: Object.fromEntries(p.map((x) => [x.id, x])) }),
  setGame: (g) => set({ game: g }),
  setPlayers: (p) => set({ players: p }),
  setMyPower: (p) => {
    if (p) localStorage.setItem('diplomacy.myPower', p);
    else localStorage.removeItem('diplomacy.myPower');
    set({ myPower: p, selectedUnit: null, pendingAction: null });
  },

  myUnits: () => {
    const { game, myPower } = get();
    if (!game || !myPower) return [];
    return game.units.filter((u) => u.power === myPower);
  },

  selectUnit: (province) => set({ selectedUnit: province, pendingAction: null, supportStage: null, supportTargetProvince: null }),
  setPendingAction: (a) => set({ pendingAction: a, supportStage: a === 'support' ? 'pick-target' : null }),

  handleProvinceClick: (clickedProvince) => {
    const state = get();
    const { game, myPower, selectedUnit, pendingAction, supportStage, supportTargetProvince } = state;
    if (!game || !myPower) return;
    const myUnitHere = game.units.find((u) => u.province === clickedProvince && u.power === myPower);

    // No unit selected yet: selecting one of my own units starts order composition.
    if (!selectedUnit) {
      if (myUnitHere) set({ selectedUnit: clickedProvince, pendingAction: null });
      return;
    }

    if (!pendingAction) {
      // Clicking a different own unit re-selects; otherwise ignore until an action is chosen.
      if (myUnitHere) set({ selectedUnit: clickedProvince });
      return;
    }

    if (pendingAction === 'move') {
      set((s) => ({
        draftOrders: { ...s.draftOrders, [selectedUnit]: { kind: 'move', province: selectedUnit, to: clickedProvince } },
        selectedUnit: null,
        pendingAction: null,
      }));
      return;
    }

    if (pendingAction === 'convoy') {
      // First click: which army to convoy (any unit, not necessarily mine, but
      // typically mine); second click: destination.
      if (supportStage === 'pick-target') {
        set({ supportTargetProvince: clickedProvince, supportStage: 'pick-destination' });
        return;
      }
      if (supportStage === 'pick-destination' && supportTargetProvince) {
        set((s) => ({
          draftOrders: {
            ...s.draftOrders,
            [selectedUnit]: { kind: 'convoy', province: selectedUnit, armyProvince: supportTargetProvince, to: clickedProvince },
          },
          selectedUnit: null,
          pendingAction: null,
          supportStage: null,
          supportTargetProvince: null,
        }));
      }
      return;
    }

    if (pendingAction === 'support') {
      if (supportStage === 'pick-target') {
        set({ supportTargetProvince: clickedProvince, supportStage: 'pick-destination' });
        return;
      }
      if (supportStage === 'pick-destination' && supportTargetProvince) {
        const isHoldSupport = clickedProvince === supportTargetProvince;
        set((s) => ({
          draftOrders: {
            ...s.draftOrders,
            [selectedUnit]: isHoldSupport
              ? { kind: 'support-hold', province: selectedUnit, targetProvince: supportTargetProvince }
              : { kind: 'support-move', province: selectedUnit, targetProvince: supportTargetProvince, to: clickedProvince },
          },
          selectedUnit: null,
          pendingAction: null,
          supportStage: null,
          supportTargetProvince: null,
        }));
      }
    }
  },

  clearDraftFor: (province) =>
    set((s) => {
      const next = { ...s.draftOrders };
      delete next[province];
      return { draftOrders: next };
    }),
  clearAllDrafts: () => set({ draftOrders: {} }),

  setViewMode: (v) => set({ viewMode: v }),
  setTerrainMode: (t) => set({ terrainMode: t }),
  setTerritoryColorMode: (m) => set({ territoryColorMode: m }),
  setHighlightMineOnly: (v) => set({ highlightMineOnly: v }),
  setActivePanel: (p) => set({ activePanel: p }),
}));
