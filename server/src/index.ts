import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  buildOptions,
  createGame,
  getGame,
  getHistory,
  getPlayers,
  getStats,
  listGames,
  maybeResolve,
  simulateHypothetical,
  submitAdjustments,
  submitOrders,
  submitRetreats,
} from './game/gameService.js';
import { PROVINCES } from './map/provinces.js';
import type { Power } from './map/provinces.js';

const app = express();
app.use(cors());
app.use(express.json());

const subscribers = new Map<string, Set<WebSocket>>();
function broadcast(gameId: string) {
  const sockets = subscribers.get(gameId);
  if (!sockets) return;
  const game = getGame(gameId);
  const payload = JSON.stringify({ type: 'game-update', game });
  for (const ws of sockets) if (ws.readyState === WebSocket.OPEN) ws.send(payload);
}

app.get('/api/map', (_req, res) => {
  res.json(Object.values(PROVINCES));
});

app.get('/api/games', (_req, res) => {
  res.json(listGames());
});

app.post('/api/games', (req, res) => {
  const game = createGame(req.body);
  res.status(201).json(game);
});

app.get('/api/games/:id', (req, res) => {
  const game = maybeResolve(req.params.id);
  if (!game) return res.status(404).json({ error: 'not found' });
  res.json(game);
});

app.get('/api/games/:id/players', (req, res) => {
  res.json(getPlayers(req.params.id));
});

app.post('/api/games/:id/orders', (req, res) => {
  try {
    const game = submitOrders(req.params.id, req.body.power as Power, req.body.orders);
    broadcast(req.params.id);
    res.json(game);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/games/:id/retreats', (req, res) => {
  try {
    const game = submitRetreats(req.params.id, req.body.power as Power, req.body.retreats);
    broadcast(req.params.id);
    res.json(game);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/games/:id/adjustments', (req, res) => {
  try {
    const game = submitAdjustments(req.params.id, req.body.power as Power, req.body.orders);
    broadcast(req.params.id);
    res.json(game);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/games/:id/history', (req, res) => {
  res.json(getHistory(req.params.id));
});

app.get('/api/games/:id/stats', (req, res) => {
  res.json(getStats(req.params.id));
});

app.get('/api/games/:id/build-options', (req, res) => {
  res.json(buildOptions(req.params.id, req.query.power as Power));
});

app.post('/api/games/:id/hypothetical', (req, res) => {
  try {
    const result = simulateHypothetical(req.params.id, req.body.power as Power, req.body.orders);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '', 'http://localhost');
  const gameId = url.searchParams.get('gameId');
  if (!gameId) {
    ws.close();
    return;
  }
  if (!subscribers.has(gameId)) subscribers.set(gameId, new Set());
  subscribers.get(gameId)!.add(ws);
  ws.on('close', () => subscribers.get(gameId)?.delete(ws));
});

const PORT = Number(process.env.PORT ?? 4000);
server.listen(PORT, () => {
  console.log(`Diplomacy server listening on http://localhost:${PORT}`);
});
