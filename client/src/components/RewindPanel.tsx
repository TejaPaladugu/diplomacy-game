import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { api } from '../api/client';
import type { SceneArrow } from './MapScene';
import type { TurnHistoryEntry } from '../types/domain';

interface Props {
  onFrameChange: (units: TurnHistoryEntry['unitsAfter'] | null, arrows: SceneArrow[]) => void;
}

export function RewindPanel({ onFrameChange }: Props) {
  const { game } = useGameStore();
  const [history, setHistory] = useState<TurnHistoryEntry[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [showingBefore, setShowingBefore] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!game) return;
    api.getHistory(game.id).then((h) => {
      setHistory(h);
      setTurnIndex(h.length > 0 ? h.length - 1 : 0);
    });
  }, [game, game?.season, game?.year, game?.phase]);

  const turn = history[turnIndex];

  const arrows: SceneArrow[] = useMemo(() => {
    if (!turn) return [];
    return turn.resolved
      .filter((r) => r.order.kind === 'move' && r.order.to)
      .map((r) => ({
        from: r.order.unit.province,
        to: r.order.to!,
        color: r.outcome === 'succeeded' ? '#8ad1ff' : r.outcome === 'dislodged' ? '#ff6b6b' : '#ffb14e',
        dashed: r.outcome !== 'succeeded',
      }));
  }, [turn]);

  useEffect(() => {
    if (!turn) {
      onFrameChange(null, []);
      return;
    }
    onFrameChange(showingBefore ? turn.unitsBefore : turn.unitsAfter, arrows);
  }, [turn, showingBefore, arrows, onFrameChange]);

  useEffect(() => {
    if (!playing || !turn) return;
    setShowingBefore(true);
    const t1 = setTimeout(() => setShowingBefore(false), 1300);
    const t2 = setTimeout(() => {
      setTurnIndex((i) => {
        if (i + 1 >= history.length) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [playing, turnIndex, turn, history.length]);

  if (!game) return null;

  return (
    <div className="orders-panel">
      <h3>Rewind</h3>
      {history.length === 0 ? (
        <p className="muted">No resolved turns yet.</p>
      ) : (
        <>
          <p className="muted">
            {turn?.season} {turn?.year} ({turn?.phase}) — {showingBefore ? 'before' : 'after'} resolution
          </p>
          <input
            type="range"
            min={0}
            max={history.length - 1}
            value={turnIndex}
            onChange={(e) => {
              setPlaying(false);
              setTurnIndex(Number(e.target.value));
              setShowingBefore(false);
            }}
          />
          <div className="action-buttons">
            <button onClick={() => setShowingBefore((b) => !b)}>{showingBefore ? 'Show result' : 'Show before'}</button>
            <button onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play from here'}</button>
          </div>
          <ul className="order-list">
            {turn?.resolved.map((r, i) => (
              <li key={i}>
                <span className="order-unit">{r.order.unit.province.toUpperCase()}</span>
                <span className="order-desc">
                  {r.order.kind} {r.order.to ? `→ ${r.order.to.toUpperCase()}` : ''} — {r.outcome}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
