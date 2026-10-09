# Diplomacy

A solo/multiplayer web implementation of the classic board game Diplomacy
(4th edition rules). Personal-use project — not published.

## Status

Feature-complete first version, built incrementally and verified at each
stage (unit/integration tests for the backend, Playwright-driven visual and
interaction checks for the frontend):

- Full standard-map rules engine: moves, support (with the target-province
  cut exception), convoys (multi-route, disruption, the convoy-paradox
  exception rules), standoffs, dislodgement, retreats, builds/disbands.
  Validated against the rulebook's own diagrams and its full Spring 1901
  sample-game turn.
- Async multiplayer: players submit orders independently over hours or
  days; a turn resolves once everyone's in, or an optional deadline
  passes (missing orders default to hold).
- Solo mode with a heuristic AI controlling the other powers.
- "What if" hypothetical move preview that simulates a draft order set
  against everyone else's actual submitted orders, without committing it.
- One Three.js scene (not layered 2D/3D) renders the whole board as
  extruded terrain with topography, draggable/zoomable via OrbitControls,
  switchable between top-down, orthographic/isometric, and perspective
  camera presets.
- Unique per-power unit models (shared pawn/ship base, distinct "crest"
  geometry per country).
- Rewind/replay viewer: scrub through turn history, see each turn's
  resolved orders as colored arrows, before/after toggle, autoplay.
- Per-player stats dashboard (supply centers and units over time).
- Searchable in-app rules reference, available any time.

### Known rough edges

- Province labels can overlap in the most tightly-packed clusters
  (Kiel/Berlin/Prussia, Vienna/Budapest/Trieste) at default zoom — zoom in
  to disambiguate.
- Turn animation is a before/after transition with colored arrows, not a
  continuously interpolated unit-by-unit tween.
- The AI bot plays legally and reasonably (expands into open centers,
  supports its own attacks) but has no lookahead or diplomacy — it's a
  solid solo-mode opponent, not a strong one.
- The adjudicator's handling of the convoy-paradox rules (21/22) covers
  everything in the rulebook's own examples; true deep recursive paradoxes
  (vanishingly rare in actual play) fall back to a safe default rather
  than a full generalized solver.

## Layout

- `server/` — Node/TypeScript backend: rules engine (`src/engine`), map
  data (`src/map`), game/session service + persistence (`src/game`,
  `src/db`), AI bot (`src/ai`), REST + WebSocket API (`src/index.ts`)
- `client/` — React + Three.js frontend (`src/components`, `src/store`,
  `src/map`, `src/api`)

## Running it

```
cd server && npm install && npm run dev   # http://localhost:4000
cd client && npm install && npm run dev   # http://localhost:5173
```

Open the client URL, create a game from the lobby (pick which powers are
human vs AI, solo or multiplayer, an optional turn deadline), then pick
which power you're playing as from the top bar. For multiplayer over
hours/days, share the game URL (`?game=<id>`) with the other players —
each of them picks their own power from the dropdown and the game state
stays in sync over the WebSocket connection.

## Tests

```
cd server && npm test
```
