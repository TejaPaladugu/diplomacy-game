import { PROVINCES, POWERS, type Power } from '../map/provinces.js';
import type { Unit } from '../engine/types.js';

// Standard 1901 starting positions (unit type + coast where relevant).
const STARTING_UNITS: Array<{ power: Power; type: 'A' | 'F'; province: string; coast?: 'nc' | 'sc' }> = [
  { power: 'AUSTRIA', type: 'A', province: 'vie' },
  { power: 'AUSTRIA', type: 'A', province: 'bud' },
  { power: 'AUSTRIA', type: 'F', province: 'tri' },
  { power: 'ENGLAND', type: 'F', province: 'lon' },
  { power: 'ENGLAND', type: 'F', province: 'edi' },
  { power: 'ENGLAND', type: 'A', province: 'lvp' },
  { power: 'FRANCE', type: 'A', province: 'par' },
  { power: 'FRANCE', type: 'A', province: 'mar' },
  { power: 'FRANCE', type: 'F', province: 'bre' },
  { power: 'GERMANY', type: 'A', province: 'ber' },
  { power: 'GERMANY', type: 'A', province: 'mun' },
  { power: 'GERMANY', type: 'F', province: 'kie' },
  { power: 'ITALY', type: 'A', province: 'rom' },
  { power: 'ITALY', type: 'A', province: 'ven' },
  { power: 'ITALY', type: 'F', province: 'nap' },
  { power: 'RUSSIA', type: 'A', province: 'mos' },
  { power: 'RUSSIA', type: 'A', province: 'war' },
  { power: 'RUSSIA', type: 'F', province: 'sev' },
  { power: 'RUSSIA', type: 'F', province: 'stp', coast: 'sc' },
  { power: 'TURKEY', type: 'F', province: 'ank' },
  { power: 'TURKEY', type: 'A', province: 'con' },
  { power: 'TURKEY', type: 'A', province: 'smy' },
];

export function initialUnits(): Unit[] {
  return STARTING_UNITS.map((u) => ({ type: u.type, power: u.power, province: u.province, coast: u.coast }));
}

export function initialSupplyCenters(): Record<string, Power> {
  const out: Record<string, Power> = {};
  for (const p of Object.values(PROVINCES)) {
    if (p.supplyCenter && p.home) out[p.id] = p.home;
  }
  return out;
}

export function homePowers(): Power[] {
  return [...POWERS];
}
