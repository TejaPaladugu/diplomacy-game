import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DIPLOMACY_DB_PATH ?? new URL('../../data/diplomacy.sqlite', import.meta.url).pathname;
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  season TEXT NOT NULL DEFAULT 'SPRING',
  year INTEGER NOT NULL DEFAULT 1901,
  phase TEXT NOT NULL DEFAULT 'orders',
  deadline_minutes INTEGER,
  deadline_at TEXT,
  units_json TEXT NOT NULL,
  supply_centers_json TEXT NOT NULL,
  pending_dislodgements_json TEXT NOT NULL DEFAULT '[]',
  winner TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  power TEXT NOT NULL,
  name TEXT NOT NULL,
  is_ai INTEGER NOT NULL DEFAULT 0,
  civil_disorder INTEGER NOT NULL DEFAULT 0,
  eliminated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game_id, power)
);

CREATE TABLE IF NOT EXISTS pending_orders (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  power TEXT NOT NULL,
  turn_key TEXT NOT NULL,
  orders_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  PRIMARY KEY (game_id, power, turn_key)
);

CREATE TABLE IF NOT EXISTS turn_history (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  season TEXT NOT NULL,
  year INTEGER NOT NULL,
  phase TEXT NOT NULL,
  units_before_json TEXT NOT NULL,
  orders_json TEXT NOT NULL,
  resolved_json TEXT NOT NULL,
  units_after_json TEXT NOT NULL,
  supply_centers_after_json TEXT NOT NULL,
  dislodgements_json TEXT NOT NULL DEFAULT '[]',
  standoffs_json TEXT NOT NULL DEFAULT '[]',
  resolved_at TEXT NOT NULL,
  PRIMARY KEY (game_id, turn_index)
);
`);
