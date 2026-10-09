import { useCallback, useEffect, useRef, useState } from 'react';
import { MapScene, type SceneArrow } from './components/MapScene';
import { OrdersPanel } from './components/OrdersPanel';
import { RetreatPanel } from './components/RetreatPanel';
import { AdjustmentPanel } from './components/AdjustmentPanel';
import { RulesPanel } from './components/RulesPanel';
import { StatsPanel } from './components/StatsPanel';
import { RewindPanel } from './components/RewindPanel';
import { Lobby } from './components/Lobby';
import { useGameStore } from './store/gameStore';
import { api, wsUrl } from './api/client';
import { POWERS, POWER_COLORS } from './types/domain';
import type { Power, Unit } from './types/domain';
import './App.css';

type Frame = { units: Unit[]; arrows: SceneArrow[]; label: string } | null;

function GameView({ gameId, onExit }: { gameId: string; onExit: () => void }) {
  const {
    provinces,
    setProvinces,
    game,
    setGame,
    players,
    setPlayers,
    myPower,
    setMyPower,
    viewMode,
    setViewMode,
    terrainMode,
    setTerrainMode,
    activePanel,
    setActivePanel,
  } = useGameStore();
  const [frame, setFrame] = useState<Frame>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (provinces.length === 0) api.getMap().then(setProvinces);
  }, [provinces.length, setProvinces]);

  useEffect(() => {
    api.getGame(gameId).then(setGame);
    api.getPlayers(gameId).then(setPlayers);
    const ws = new WebSocket(wsUrl(gameId));
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'game-update') setGame(msg.game);
    };
    const poll = setInterval(() => api.getGame(gameId).then(setGame), 15000);
    return () => {
      ws.close();
      clearInterval(poll);
    };
  }, [gameId, setGame, setPlayers]);

  const onRewindFrame = useCallback((units: Unit[] | null, arrows: SceneArrow[]) => {
    setFrame(units ? { units, arrows, label: '' } : null);
  }, []);

  if (!game) return <div className="loading">Loading game…</div>;

  return (
    <div className="game-view">
      <header className="top-bar">
        <button className="link" onClick={onExit}>
          ← Lobby
        </button>
        <div className="turn-indicator">
          <strong>{game.name}</strong> — {game.season} {game.year} · {game.phase}
          {game.status === 'completed' && <span className="winner-badge"> · {game.winner} WINS</span>}
        </div>
        <div className="power-picker">
          <label>
            {myPower && <span className="power-swatch" style={{ background: POWER_COLORS[myPower] }} />}
            Play as:
            <select value={myPower ?? ''} onChange={(e) => setMyPower((e.target.value || null) as Power | null)}>
              <option value="">(spectate)</option>
              {POWERS.map((p) => (
                <option key={p} value={p}>
                  {p} {players.find((pl) => pl.power === p)?.isAI ? '(AI)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="view-mode-buttons">
          {(['top-down', 'orthographic', 'perspective'] as const).map((v) => (
            <button key={v} className={viewMode === v ? 'active' : ''} onClick={() => setViewMode(v)}>
              {v}
            </button>
          ))}
        </div>
        <div className="terrain-mode-buttons">
          {(['flat', 'relief'] as const).map((t) => (
            <button key={t} className={terrainMode === t ? 'active' : ''} onClick={() => setTerrainMode(t)} title="Toggle flat parchment map vs relief terrain">
              {t === 'flat' ? 'Map' : 'Terrain'}
            </button>
          ))}
        </div>
      </header>

      <div className="main-layout">
        <div className="map-container">
          <MapScene displayUnits={frame?.units} arrows={frame?.arrows} interactive={!frame} />
          {frame && (
            <div className="frame-badge">
              {frame.label}
              <button className="link" onClick={() => setFrame(null)}>
                clear
              </button>
            </div>
          )}
        </div>
        <aside className="side-panel">
          <nav className="panel-tabs">
            {(['orders', 'rules', 'stats', 'rewind'] as const).map((p) => (
              <button key={p} className={activePanel === p ? 'active' : ''} onClick={() => setActivePanel(p)}>
                {p}
              </button>
            ))}
          </nav>
          <div className="panel-body">
            {activePanel === 'orders' && (
              <>
                {game.phase === 'orders' && <OrdersPanel onPreview={(f) => setFrame(f)} />}
                {game.phase === 'retreat' && <RetreatPanel />}
                {game.phase === 'adjustment' && <AdjustmentPanel />}
              </>
            )}
            {activePanel === 'rules' && <RulesPanel />}
            {activePanel === 'stats' && <StatsPanel />}
            {activePanel === 'rewind' && <RewindPanel onFrameChange={onRewindFrame} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  const [gameId, setGameId] = useState<string | null>(() => new URLSearchParams(location.search).get('game'));

  function enter(id: string) {
    setGameId(id);
    const url = new URL(location.href);
    url.searchParams.set('game', id);
    history.replaceState(null, '', url.toString());
  }

  function exit() {
    setGameId(null);
    const url = new URL(location.href);
    url.searchParams.delete('game');
    history.replaceState(null, '', url.toString());
  }

  if (!gameId) return <Lobby onEnter={enter} />;
  return <GameView gameId={gameId} onExit={exit} />;
}
