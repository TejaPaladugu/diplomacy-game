import type { GameState, MovementResult, PlayerInfo, Power, Province, StatsSeries, TurnHistoryEntry } from '../types/domain';

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getMap: () => req<Province[]>('/api/map'),
  listGames: () => req<GameState[]>('/api/games'),
  getGame: (id: string) => req<GameState>(`/api/games/${id}`),
  getPlayers: (id: string) => req<PlayerInfo[]>(`/api/games/${id}/players`),
  createGame: (body: { name: string; mode: 'solo' | 'multiplayer'; players: Partial<Record<Power, { name: string; isAI: boolean }>>; deadlineMinutes?: number }) =>
    req<GameState>('/api/games', { method: 'POST', body: JSON.stringify(body) }),
  submitOrders: (id: string, power: Power, orders: unknown[]) =>
    req<GameState>(`/api/games/${id}/orders`, { method: 'POST', body: JSON.stringify({ power, orders }) }),
  submitRetreats: (id: string, power: Power, retreats: unknown[]) =>
    req<GameState>(`/api/games/${id}/retreats`, { method: 'POST', body: JSON.stringify({ power, retreats }) }),
  submitAdjustments: (id: string, power: Power, orders: unknown[]) =>
    req<GameState>(`/api/games/${id}/adjustments`, { method: 'POST', body: JSON.stringify({ power, orders }) }),
  getHistory: (id: string) => req<TurnHistoryEntry[]>(`/api/games/${id}/history`),
  getStats: (id: string) => req<StatsSeries>(`/api/games/${id}/stats`),
  getBuildOptions: (id: string, power: Power) => req<string[]>(`/api/games/${id}/build-options?power=${power}`),
  hypothetical: (id: string, power: Power, orders: unknown[]) =>
    req<MovementResult>(`/api/games/${id}/hypothetical`, { method: 'POST', body: JSON.stringify({ power, orders }) }),
};

export function wsUrl(gameId: string): string {
  const url = new URL(BASE);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.searchParams.set('gameId', gameId);
  return url.toString();
}
