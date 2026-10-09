import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { api } from '../api/client';
import type { SceneArrow } from './MapScene';
import type { TurnHistoryEntry, Unit } from '../types/domain';
import { buildPlaybackUnits, sampleTurnPlayback, usePlaybackClock, type AnimatedUnitFrame } from '../hooks/useTurnPlayback';
import { arrowsForTurn } from '../map/turnArrows';

type Frame = { units?: Unit[]; animatedUnits?: AnimatedUnitFrame[]; arrows: SceneArrow[]; label: string } | null;

const PLAYBACK_MS = 2400;

interface Props {
  onFrameChange: (frame: Frame) => void;
}

export function RewindPanel({ onFrameChange }: Props) {
  const { game } = useGameStore();
  const [history, setHistory] = useState<TurnHistoryEntry[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!game) return;
    api.getHistory(game.id).then((h) => {
      setHistory(h);
      setTurnIndex(h.length > 0 ? h.length - 1 : 0);
    });
  }, [game, game?.season, game?.year, game?.phase]);

  const turn = history[turnIndex];
  const t = usePlaybackClock(playing && !!turn, PLAYBACK_MS);

  // Auto-advance to the next turn once a playback finishes.
  useEffect(() => {
    if (!playing || !turn || t < 1) return;
    const timer = setTimeout(() => {
      setTurnIndex((i) => {
        if (i + 1 >= history.length) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [playing, turn, t, history.length]);

  useEffect(() => {
    if (!turn) {
      onFrameChange(null);
      return;
    }
    const arrows = arrowsForTurn(turn);
    if (playing) {
      const animatedUnits = sampleTurnPlayback(buildPlaybackUnits(turn), t);
      onFrameChange({ animatedUnits, arrows, label: `${turn.season} ${turn.year} — replaying…` });
    } else {
      onFrameChange({ units: turn.unitsAfter, arrows, label: `${turn.season} ${turn.year} (${turn.phase})` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, playing, t]);

  if (!game) return null;

  return (
    <div className="orders-panel">
      <h3>Rewind</h3>
      {history.length === 0 ? (
        <p className="muted">No resolved turns yet.</p>
      ) : (
        <>
          <p className="muted">
            {turn?.season} {turn?.year} ({turn?.phase})
          </p>
          <input
            type="range"
            min={0}
            max={history.length - 1}
            value={turnIndex}
            onChange={(e) => {
              setPlaying(false);
              setTurnIndex(Number(e.target.value));
            }}
          />
          <div className="action-buttons">
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
