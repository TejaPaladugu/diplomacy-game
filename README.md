# Diplomacy

A solo/multiplayer web implementation of the classic board game Diplomacy
(4th edition rules). Personal-use project — not published.

## Status

Work in progress, built incrementally. See commit history and `server/src`
for the current state. Planned feature set:

- Full standard-map rules engine (moves, support, convoy, retreats, builds)
- Async multiplayer: players submit orders over hours/days, turns resolve
  once everyone is in (or a deadline passes)
- Solo mode with AI-controlled opponents
- 2D/3D hybrid map: draggable, zoomable, multiple camera views
- Animated 3D turn resolution and a rewind/replay viewer with arrows
- "What if" hypothetical move preview
- Per-player stats dashboard
- Always-available in-app rules reference

## Layout

- `server/` — Node/TypeScript backend: rules engine, game state, API, AI bot
- `client/` — React/Three.js frontend

## Dev

```
cd server && npm install && npm run dev
cd client && npm install && npm run dev
```
