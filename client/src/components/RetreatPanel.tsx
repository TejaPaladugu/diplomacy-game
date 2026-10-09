import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { api } from '../api/client';

export function RetreatPanel() {
  const { game, myPower, setGame } = useGameStore();
  const [choices, setChoices] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!game || !myPower || game.phase !== 'retreat') return null;
  const mine = game.pendingDislodgements.filter((d) => d.unit.power === myPower);
  if (mine.length === 0) return <div className="panel-empty">No retreats needed for you this turn.</div>;

  async function submit() {
    if (!game || !myPower) return;
    setSubmitting(true);
    try {
      const retreats = mine.map((d) => ({ province: d.unit.province, to: choices[d.unit.province] ?? null }));
      const updated = await api.submitRetreats(game.id, myPower, retreats);
      setGame(updated);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="orders-panel">
      <h3>Retreats — {game.season} {game.year}</h3>
      {mine.map((d) => (
        <div key={d.unit.province} className="retreat-row">
          <strong>{d.unit.type} {d.unit.province.toUpperCase()}</strong> dislodged from {d.attackerFrom.toUpperCase()}
          <select value={choices[d.unit.province] ?? ''} onChange={(e) => setChoices((c) => ({ ...c, [d.unit.province]: e.target.value || null }))}>
            <option value="">Disband</option>
            {d.retreatOptions.map((o) => (
              <option key={o} value={o}>
                {o.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button className="primary" disabled={submitting} onClick={submit}>
        {submitting ? 'Submitting…' : 'Submit retreats'}
      </button>
    </div>
  );
}
