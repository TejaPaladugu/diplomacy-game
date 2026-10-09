import type { CoastId, Power } from '../../map/provinces.js';
import type { Order, Unit } from '../types.js';

export function A(power: Power, province: string, coast?: CoastId): Unit {
  return { type: 'A', power, province, coast };
}
export function F(power: Power, province: string, coast?: CoastId): Unit {
  return { type: 'F', power, province, coast };
}

export function hold(province: string): Order {
  return { kind: 'hold', unit: { province } };
}
export function move(province: string, to: string, toCoast?: CoastId): Order {
  return { kind: 'move', unit: { province }, to, toCoast };
}
export function supportHold(province: string, target: string): Order {
  return { kind: 'support-hold', unit: { province }, target: { province: target } };
}
export function supportMove(province: string, target: string, to: string): Order {
  return { kind: 'support-move', unit: { province }, target: { province: target }, to };
}
export function convoy(province: string, army: string, to: string): Order {
  return { kind: 'convoy', unit: { province }, army: { province: army }, to };
}
