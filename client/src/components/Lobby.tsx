import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { POWERS } from '../types/domain';
import type { GameState, Power } from '../types/domain';

export function Lobby({ onEnter }: { onEnter: (gameId: string) => void }) {
  const [games, setGames] = useState<GameState[]>([]);
  const [name, setName] = useState('My Diplomacy Game');
  const [mode, setMode] = useState<'solo' | 'multiplayer'>('solo');
  const [humanPowers, setHumanPowers] = useState<Set<Power>>(new Set(['AUSTRIA']));
  const [deadlineMinutes, setDeadlineMinutes] = useState<number | ''>('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listGames()
      .then(setGames)
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  function toggleHuman(p: Power) {
    setHumanPowers((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const players = Object.fromEntries(
        POWERS.map((p) => [p, { name: humanPowers.has(p) ? p : `${p} (AI)`, isAI: mode === 'solo' ? !humanPowers.has(p) : !humanPowers.has(p) }]),
      );
      const game = await api.createGame({ name, mode, players, deadlineMinutes: deadlineMinutes === '' ? undefined : deadlineMinutes });
      onEnter(game.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="lobby">
      <h1>Diplomacy</h1>
      <div className="lobby-grid">
        <div className="lobby-create panel-box">
          <h2>New game</h2>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as 'solo' | 'multiplayer')}>
              <option value="solo">Solo (vs AI)</option>
              <option value="multiplayer">Multiplayer (async, over hours/days)</option>
            </select>
          </label>
          <label>
            Turn deadline (minutes, optional)
            <input
              type="number"
              min={1}
              value={deadlineMinutes}
              placeholder="No deadline"
              onChange={(e) => setDeadlineMinutes(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </label>
          <p className="muted">Pick which powers are human-controlled. The rest are AI-controlled.</p>
          <div className="power-toggle-grid">
            {POWERS.map((p) => (
              <label key={p} className="checkbox-row">
                <input type="checkbox" checked={humanPowers.has(p)} onChange={() => toggleHuman(p)} />
                {p}
              </label>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={creating} onClick={create}>
            {creating ? 'Creating…' : 'Create game'}
          </button>
        </div>

        <div className="lobby-list panel-box">
          <h2>Existing games</h2>
          {loadError && (
            <p className="error">
              Can't reach the backend ({loadError}). Is the server running on port 4000?
            </p>
          )}
          {!loadError && games.length === 0 && <p className="muted">No games yet.</p>}
          <ul>
            {games.map((g) => (
              <li key={g.id}>
                <button className="link" onClick={() => onEnter(g.id)}>
                  {g.name}
                </button>
                <span className="muted">
                  {' '}
                  — {g.season} {g.year}, {g.phase} ({g.status})
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
