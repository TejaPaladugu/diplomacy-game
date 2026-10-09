import { randomUUID } from 'node:crypto';
import { db } from '../db/db.js';
import { adjudicateMovement } from '../engine/adjudicator.js';
import { resolveRetreats } from '../engine/retreats.js';
import { applyAdjustments, computeAdjustmentCounts, buildableHomeCenters } from '../engine/adjustments.js';
import type { AdjustmentOrder, Dislodgement, MovementResult, Order, RetreatOrder, Unit } from '../engine/types.js';
import { PROVINCES, type Power } from '../map/provinces.js';
import { homePowers, initialSupplyCenters, initialUnits } from './setup.js';
import { convertOrders } from './orderConversion.js';
import { generateAIOrders, generateAIRetreats, generateAIAdjustments } from '../ai/bot.js';
import type { ApiAdjustmentOrder, ApiOrder, ApiRetreatOrder, CreateGameRequest, Phase, Season } from './apiTypes.js';

const WIN_SC_COUNT = 18;

export interface GameRow {
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

interface PlayerRow {
  power: Power;
  name: string;
  isAI: boolean;
  civilDisorder: boolean;
  eliminated: boolean;
}

function rowToGame(row: any): GameRow {
  return {
    id: row.id,
    name: row.name,
    mode: row.mode,
    status: row.status,
    season: row.season,
    year: row.year,
    phase: row.phase,
    deadlineMinutes: row.deadline_minutes,
    deadlineAt: row.deadline_at,
    units: JSON.parse(row.units_json),
    supplyCenters: JSON.parse(row.supply_centers_json),
    pendingDislodgements: JSON.parse(row.pending_dislodgements_json),
    winner: row.winner,
    createdAt: row.created_at,
  };
}

export function getGame(id: string): GameRow | null {
  const row = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  return row ? rowToGame(row) : null;
}

export function getPlayers(gameId: string): PlayerRow[] {
  const rows = db.prepare('SELECT * FROM players WHERE game_id = ?').all(gameId) as any[];
  return rows.map((r) => ({ power: r.power, name: r.name, isAI: !!r.is_ai, civilDisorder: !!r.civil_disorder, eliminated: !!r.eliminated }));
}

export function listGames(): GameRow[] {
  const rows = db.prepare('SELECT * FROM games ORDER BY created_at DESC').all();
  return rows.map(rowToGame);
}

export function createGame(req: CreateGameRequest): GameRow {
  const id = randomUUID();
  const now = new Date().toISOString();
  const units = initialUnits();
  const supplyCenters = initialSupplyCenters();
  const deadlineAt = req.deadlineMinutes ? new Date(Date.now() + req.deadlineMinutes * 60_000).toISOString() : null;

  db.prepare(
    `INSERT INTO games (id, name, mode, status, season, year, phase, deadline_minutes, deadline_at, units_json, supply_centers_json, pending_dislodgements_json, winner, created_at)
     VALUES (?, ?, ?, 'active', 'SPRING', 1901, 'orders', ?, ?, ?, ?, '[]', NULL, ?)`,
  ).run(id, req.name, req.mode, req.deadlineMinutes ?? null, deadlineAt, JSON.stringify(units), JSON.stringify(supplyCenters), now);

  const insertPlayer = db.prepare('INSERT INTO players (game_id, power, name, is_ai) VALUES (?, ?, ?, ?)');
  for (const power of homePowers()) {
    const cfg = req.players[power];
    insertPlayer.run(id, power, cfg?.name ?? `${power} (AI)`, cfg?.isAI || !cfg ? 1 : 0);
  }

  return getGame(id)!;
}

function turnKey(game: GameRow): string {
  return `${game.season}-${game.year}-${game.phase}`;
}

function activePowers(gameId: string): PlayerRow[] {
  return getPlayers(gameId).filter((p) => !p.eliminated);
}

export function submitOrders(gameId: string, power: Power, apiOrders: ApiOrder[]): GameRow {
  const game = requireGame(gameId);
  if (game.phase !== 'orders') throw new Error(`Game is not in the orders phase (currently ${game.phase})`);
  const orders = convertOrders(apiOrders, power, game.units);
  db.prepare(
    `INSERT INTO pending_orders (game_id, power, turn_key, orders_json, submitted_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(game_id, power, turn_key) DO UPDATE SET orders_json = excluded.orders_json, submitted_at = excluded.submitted_at`,
  ).run(gameId, power, turnKey(game), JSON.stringify(orders), new Date().toISOString());
  return maybeResolve(gameId);
}

export function submitRetreats(gameId: string, power: Power, apiRetreats: ApiRetreatOrder[]): GameRow {
  const game = requireGame(gameId);
  if (game.phase !== 'retreat') throw new Error(`Game is not in the retreat phase (currently ${game.phase})`);
  const own = game.pendingDislodgements.filter((d) => d.unit.power === power);
  const retreats: RetreatOrder[] = apiRetreats
    .filter((r) => own.some((d) => d.unit.province === r.province))
    .map((r) => ({ unit: { province: r.province }, to: r.to, toCoast: r.toCoast }));
  db.prepare(
    `INSERT INTO pending_orders (game_id, power, turn_key, orders_json, submitted_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(game_id, power, turn_key) DO UPDATE SET orders_json = excluded.orders_json, submitted_at = excluded.submitted_at`,
  ).run(gameId, power, turnKey(game), JSON.stringify(retreats), new Date().toISOString());
  return maybeResolve(gameId);
}

export function submitAdjustments(gameId: string, power: Power, apiAdj: ApiAdjustmentOrder[]): GameRow {
  const game = requireGame(gameId);
  if (game.phase !== 'adjustment') throw new Error(`Game is not in the adjustment phase (currently ${game.phase})`);
  const orders: AdjustmentOrder[] = apiAdj.map((o) =>
    o.kind === 'build'
      ? { kind: 'build', power, province: o.province, unitType: o.unitType ?? 'A', coast: o.coast }
      : { kind: 'disband', power, province: o.province },
  );
  db.prepare(
    `INSERT INTO pending_orders (game_id, power, turn_key, orders_json, submitted_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(game_id, power, turn_key) DO UPDATE SET orders_json = excluded.orders_json, submitted_at = excluded.submitted_at`,
  ).run(gameId, power, turnKey(game), JSON.stringify(orders), new Date().toISOString());
  return maybeResolve(gameId);
}

function requireGame(gameId: string): GameRow {
  const g = getGame(gameId);
  if (!g) throw new Error('Game not found');
  return g;
}

function hasSubmitted(gameId: string, power: Power, key: string): boolean {
  return !!db.prepare('SELECT 1 FROM pending_orders WHERE game_id = ? AND power = ? AND turn_key = ?').get(gameId, power, key);
}

function getSubmittedOrders(gameId: string, power: Power, key: string): any[] {
  const row = db.prepare('SELECT orders_json FROM pending_orders WHERE game_id = ? AND power = ? AND turn_key = ?').get(gameId, power, key) as any;
  return row ? JSON.parse(row.orders_json) : [];
}

/** Auto-generates and stores orders for any AI-controlled power that hasn't submitted
 * for the current phase yet. */
function ensureAIOrders(gameId: string): void {
  const game = requireGame(gameId);
  const key = turnKey(game);
  for (const player of activePowers(gameId)) {
    if (!player.isAI) continue;
    if (hasSubmitted(gameId, player.power, key)) continue;
    if (game.phase === 'orders') {
      const orders = generateAIOrders(game, player.power);
      db.prepare('INSERT INTO pending_orders (game_id, power, turn_key, orders_json, submitted_at) VALUES (?, ?, ?, ?, ?)').run(
        gameId,
        player.power,
        key,
        JSON.stringify(convertOrders(orders, player.power, game.units)),
        new Date().toISOString(),
      );
    } else if (game.phase === 'retreat') {
      const own = game.pendingDislodgements.filter((d) => d.unit.power === player.power);
      if (own.length === 0) continue;
      const retreats = generateAIRetreats(own);
      db.prepare('INSERT INTO pending_orders (game_id, power, turn_key, orders_json, submitted_at) VALUES (?, ?, ?, ?, ?)').run(
        gameId,
        player.power,
        key,
        JSON.stringify(retreats),
        new Date().toISOString(),
      );
    } else if (game.phase === 'adjustment') {
      const delta = computeAdjustmentCounts(game.units, game.supplyCenters).get(player.power) ?? 0;
      if (delta === 0) continue;
      const orders = generateAIAdjustments(game, player.power, delta);
      db.prepare('INSERT INTO pending_orders (game_id, power, turn_key, orders_json, submitted_at) VALUES (?, ?, ?, ?, ?)').run(
        gameId,
        player.power,
        key,
        JSON.stringify(orders),
        new Date().toISOString(),
      );
    }
  }
}

function allSubmitted(gameId: string): boolean {
  const game = requireGame(gameId);
  const key = turnKey(game);
  for (const player of activePowers(gameId)) {
    if (game.phase === 'retreat' && !game.pendingDislodgements.some((d) => d.unit.power === player.power)) continue;
    if (game.phase === 'adjustment') {
      const delta = computeAdjustmentCounts(game.units, game.supplyCenters).get(player.power) ?? 0;
      if (delta === 0) continue;
    }
    if (!hasSubmitted(gameId, player.power, key)) return false;
  }
  return true;
}

/** Resolves the current phase if every active power has submitted (humans directly,
 * AI auto-generated), or if the deadline has passed (missing orders default to hold,
 * per the rulebook's civil-disorder rule). Safe to call after any mutation or on a
 * read, so no background process is required to keep a game moving. */
export function maybeResolve(gameId: string): GameRow {
  ensureAIOrders(gameId);
  const game = requireGame(gameId);
  const deadlinePassed = game.deadlineAt !== null && Date.now() >= Date.parse(game.deadlineAt);
  if (!allSubmitted(gameId) && !deadlinePassed) return game;
  return resolvePhase(gameId);
}

function resolvePhase(gameId: string): GameRow {
  const game = requireGame(gameId);
  const key = turnKey(game);
  const players = activePowers(gameId);
  let nextUnits: Unit[] = game.units;
  let resolvedJson = '[]';
  let dislodgements: Dislodgement[] = [];
  let standoffs: string[] = [];

  if (game.phase === 'orders') {
    const allOrders: Order[] = [];
    for (const p of players) allOrders.push(...getSubmittedOrders(gameId, p.power, key));
    const result: MovementResult = adjudicateMovement(game.units, allOrders);
    nextUnits = result.units;
    dislodgements = result.dislodgements;
    resolvedJson = JSON.stringify(result.resolved);

    db.prepare(
      `INSERT INTO turn_history (game_id, turn_index, season, year, phase, units_before_json, orders_json, resolved_json, units_after_json, supply_centers_after_json, dislodgements_json, standoffs_json, resolved_at)
       VALUES (?, (SELECT COALESCE(MAX(turn_index), -1) + 1 FROM turn_history WHERE game_id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)`,
    ).run(
      gameId,
      gameId,
      game.season,
      game.year,
      game.phase,
      JSON.stringify(game.units),
      JSON.stringify(allOrders),
      resolvedJson,
      JSON.stringify(nextUnits),
      JSON.stringify(game.supplyCenters),
      JSON.stringify(dislodgements),
      new Date().toISOString(),
    );
  } else if (game.phase === 'retreat') {
    const allRetreats: RetreatOrder[] = [];
    for (const p of players) allRetreats.push(...getSubmittedOrders(gameId, p.power, key));
    const result = resolveRetreats(game.units, game.pendingDislodgements, allRetreats);
    nextUnits = result.units;
  } else {
    const allAdj: AdjustmentOrder[] = [];
    for (const p of players) allAdj.push(...getSubmittedOrders(gameId, p.power, key));
    const result = applyAdjustments(game.units, allAdj, game.supplyCenters);
    nextUnits = result.units;
  }

  db.prepare('DELETE FROM pending_orders WHERE game_id = ? AND turn_key = ?').run(gameId, key);

  const { season, year, phase, recomputeSC } = advancePhase(game.season, game.year, game.phase, dislodgements.length > 0);
  let supplyCenters = game.supplyCenters;
  if (recomputeSC) {
    supplyCenters = { ...supplyCenters };
    for (const p of Object.values(PROVINCES)) {
      if (!p.supplyCenter) continue;
      const occupant = nextUnits.find((u) => u.province === p.id);
      if (occupant) supplyCenters[p.id] = occupant.power;
    }
  }

  let status: GameRow['status'] = 'active';
  let winner: Power | null = null;
  if (recomputeSC) {
    const counts = new Map<Power, number>();
    for (const owner of Object.values(supplyCenters)) counts.set(owner, (counts.get(owner) ?? 0) + 1);
    for (const [power, count] of counts) {
      if (count >= WIN_SC_COUNT) {
        status = 'completed';
        winner = power;
      }
    }
  }

  // Mark eliminated powers (no units left).
  const unitPowers = new Set(nextUnits.map((u) => u.power));
  const updatePlayer = db.prepare('UPDATE players SET eliminated = ? WHERE game_id = ? AND power = ?');
  for (const p of homePowers()) updatePlayer.run(unitPowers.has(p) ? 0 : 1, gameId, p);

  const newDeadline = game.deadlineMinutes && status === 'active' ? new Date(Date.now() + game.deadlineMinutes * 60_000).toISOString() : null;

  db.prepare(
    `UPDATE games SET season = ?, year = ?, phase = ?, units_json = ?, supply_centers_json = ?, pending_dislodgements_json = ?, status = ?, winner = ?, deadline_at = ? WHERE id = ?`,
  ).run(
    season,
    year,
    phase,
    JSON.stringify(nextUnits),
    JSON.stringify(supplyCenters),
    JSON.stringify(phase === 'retreat' ? dislodgements : []),
    status,
    winner,
    newDeadline,
    gameId,
  );

  const updated = getGame(gameId)!;
  if (status === 'active') return maybeResolve(gameId); // chain through trivial phases (e.g. no dislodgements, no builds needed)
  return updated;
}

function advancePhase(
  season: Season,
  year: number,
  phase: Phase,
  hasDislodgements: boolean,
): { season: Season; year: number; phase: Phase; recomputeSC: boolean } {
  if (phase === 'orders') {
    if (hasDislodgements) return { season, year, phase: 'retreat', recomputeSC: false };
    if (season === 'SPRING') return { season: 'FALL', year, phase: 'orders', recomputeSC: false };
    return { season: 'FALL', year, phase: 'adjustment', recomputeSC: true };
  }
  if (phase === 'retreat') {
    if (season === 'SPRING') return { season: 'FALL', year, phase: 'orders', recomputeSC: false };
    return { season: 'FALL', year, phase: 'adjustment', recomputeSC: true };
  }
  // phase === 'adjustment' -> next year's Spring
  return { season: 'SPRING', year: year + 1, phase: 'orders', recomputeSC: false };
}

export function getHistory(gameId: string) {
  const rows = db.prepare('SELECT * FROM turn_history WHERE game_id = ? ORDER BY turn_index ASC').all(gameId) as any[];
  return rows.map((r) => ({
    turnIndex: r.turn_index,
    season: r.season,
    year: r.year,
    phase: r.phase,
    unitsBefore: JSON.parse(r.units_before_json),
    orders: JSON.parse(r.orders_json),
    resolved: JSON.parse(r.resolved_json),
    unitsAfter: JSON.parse(r.units_after_json),
    supplyCentersAfter: JSON.parse(r.supply_centers_after_json),
    dislodgements: JSON.parse(r.dislodgements_json),
    resolvedAt: r.resolved_at,
  }));
}

export function getStats(gameId: string) {
  const history = getHistory(gameId);
  const byPower = new Map<Power, Array<{ turnIndex: number; season: Season; year: number; supplyCenters: number; units: number }>>();
  for (const turn of history) {
    const scCounts = new Map<Power, number>();
    for (const owner of Object.values(turn.supplyCentersAfter) as Power[]) scCounts.set(owner, (scCounts.get(owner) ?? 0) + 1);
    const unitCounts = new Map<Power, number>();
    for (const u of turn.unitsAfter as Unit[]) unitCounts.set(u.power, (unitCounts.get(u.power) ?? 0) + 1);
    for (const power of homePowers()) {
      if (!byPower.has(power)) byPower.set(power, []);
      byPower.get(power)!.push({
        turnIndex: turn.turnIndex,
        season: turn.season,
        year: turn.year,
        supplyCenters: scCounts.get(power) ?? 0,
        units: unitCounts.get(power) ?? 0,
      });
    }
  }
  return Object.fromEntries(byPower);
}

export function buildOptions(gameId: string, power: Power): string[] {
  const game = requireGame(gameId);
  return buildableHomeCenters(power, game.units, game.supplyCenters);
}

/**
 * Runs the adjudicator against the current board for "what if" exploration: the
 * requesting power's draft orders, combined with whatever every other active power
 * has already submitted for this turn (or a hold, if they haven't). Nothing is
 * persisted. Lets a player check whether a planned move would actually work before
 * committing to it.
 */
export function simulateHypothetical(gameId: string, power: Power, draftApiOrders: ApiOrder[]): MovementResult {
  const game = requireGame(gameId);
  if (game.phase !== 'orders') throw new Error('Hypothetical preview is only available during the orders phase');
  const key = turnKey(game);
  const allOrders: Order[] = convertOrders(draftApiOrders, power, game.units);
  for (const p of activePowers(gameId)) {
    if (p.power === power) continue;
    const existing = getSubmittedOrders(gameId, p.power, key) as Order[];
    allOrders.push(...existing);
  }
  return adjudicateMovement(game.units, allOrders);
}
