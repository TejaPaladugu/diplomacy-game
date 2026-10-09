import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db.js';
import { createGame, getGame, getHistory, getStats, submitOrders, simulateHypothetical } from '../gameService.js';

beforeEach(() => {
  db.exec('DELETE FROM games; DELETE FROM players; DELETE FROM pending_orders; DELETE FROM turn_history;');
});

describe('solo game with AI opponents', () => {
  it('auto-resolves a turn once the human submits, via AI auto-fill', () => {
    const game = createGame({
      name: 'Solo test',
      mode: 'solo',
      players: { AUSTRIA: { name: 'Me', isAI: false } },
    });
    expect(game.season).toBe('SPRING');
    expect(game.year).toBe(1901);
    expect(game.phase).toBe('orders');

    const updated = submitOrders(game.id, 'AUSTRIA', [
      { kind: 'move', province: 'vie', to: 'tri' },
      { kind: 'hold', province: 'bud' },
      { kind: 'hold', province: 'tri' },
    ]);

    // The turn should have resolved (AI filled in for the other 6 powers), advancing
    // either to Fall orders directly, or to a retreat phase if someone got dislodged.
    expect(['FALL', 'SPRING']).toContain(updated.season);
    expect(updated.units.length).toBeGreaterThan(0);

    const history = getHistory(game.id);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].season).toBe('SPRING');
    expect(history[0].year).toBe(1901);

    const stats = getStats(game.id);
    expect(stats.AUSTRIA).toBeDefined();
    expect(stats.AUSTRIA[0].supplyCenters).toBe(3);
  });
});

describe('multiplayer game', () => {
  it('waits for every human power before resolving', () => {
    const players = Object.fromEntries(
      ['AUSTRIA', 'ENGLAND', 'FRANCE', 'GERMANY', 'ITALY', 'RUSSIA', 'TURKEY'].map((p) => [p, { name: p, isAI: false }]),
    );
    const game = createGame({ name: 'MP test', mode: 'multiplayer', players: players as any });

    const powers = ['AUSTRIA', 'ENGLAND', 'FRANCE', 'GERMANY', 'ITALY', 'RUSSIA'] as const;
    for (const power of powers) {
      const g = submitOrders(game.id, power, []);
      expect(g.phase).toBe('orders'); // still waiting on Turkey
      expect(g.season).toBe('SPRING');
    }
    const finalState = submitOrders(game.id, 'TURKEY', []);
    // Everyone held; nothing moved, so no dislodgements -> straight to Fall orders.
    expect(finalState.season).toBe('FALL');
    expect(finalState.phase).toBe('orders');
    expect(finalState.units).toHaveLength(22);
  });
});

describe('hypothetical preview', () => {
  it('simulates without persisting state', () => {
    const game = createGame({
      name: 'Hypo test',
      mode: 'multiplayer',
      players: { AUSTRIA: { name: 'A', isAI: false }, ITALY: { name: 'I', isAI: false } },
    });
    const result = simulateHypothetical(game.id, 'AUSTRIA', [
      { kind: 'move', province: 'vie', to: 'tri' },
      { kind: 'move', province: 'tri', to: 'alb' },
    ]);
    expect(result.resolved.find((r) => r.order.unit.province === 'vie')?.outcome).toBe('succeeded');

    // Game state itself must be untouched.
    const stillFresh = getGame(game.id)!;
    expect(stillFresh.season).toBe('SPRING');
    expect(stillFresh.units.find((u) => u.province === 'vie')).toBeDefined();
  });
});
