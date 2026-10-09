import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { api } from '../api/client';

export function AdjustmentPanel() {
  const { game, myPower, myUnits, setGame } = useGameStore();
  const [buildOptions, setBuildOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [disbands, setDisbands] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const delta = (() => {
    if (!game || !myPower) return 0;
    const scCount = Object.values(game.supplyCenters).filter((p) => p === myPower).length;
    const unitCount = myUnits().length;
    return scCount - unitCount;
  })();

  useEffect(() => {
    if (!game || !myPower || game.phase !== 'adjustment' || delta <= 0) return;
    api.getBuildOptions(game.id, myPower).then(setBuildOptions);
  }, [game, myPower, delta]);

  if (!game || !myPower || game.phase !== 'adjustment') return null;
  if (delta === 0) return <div className="panel-empty">No builds or disbands needed.</div>;

  async function submit() {
    if (!game || !myPower) return;
    setSubmitting(true);
    try {
      const orders =
        delta > 0
          ? selected.map((province) => ({ kind: 'build' as const, province, unitType: 'A' as const }))
          : disbands.map((province) => ({ kind: 'disband' as const, province }));
      const updated = await api.submitAdjustments(game.id, myPower, orders);
      setGame(updated);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="orders-panel">
      <h3>Adjustments — {game.year}</h3>
      {delta > 0 ? (
        <>
          <p className="muted">You may build {delta} unit(s) (Army; coastal home centers can take a Fleet via the map later).</p>
          {buildOptions.map((p) => (
            <label key={p} className="checkbox-row">
              <input
                type="checkbox"
                checked={selected.includes(p)}
                disabled={!selected.includes(p) && selected.length >= delta}
                onChange={(e) =>
                  setSelected((s) => (e.target.checked ? [...s, p] : s.filter((x) => x !== p)))
                }
              />
              {p.toUpperCase()}
            </label>
          ))}
        </>
      ) : (
        <>
          <p className="muted">You must disband {-delta} unit(s).</p>
          {myUnits().map((u) => (
            <label key={u.province} className="checkbox-row">
              <input
                type="checkbox"
                checked={disbands.includes(u.province)}
                disabled={!disbands.includes(u.province) && disbands.length >= -delta}
                onChange={(e) =>
                  setDisbands((s) => (e.target.checked ? [...s, u.province] : s.filter((x) => x !== u.province)))
                }
              />
              {u.type} {u.province.toUpperCase()}
            </label>
          ))}
        </>
      )}
      <button className="primary" disabled={submitting} onClick={submit}>
        {submitting ? 'Submitting…' : 'Confirm'}
      </button>
    </div>
  );
}
