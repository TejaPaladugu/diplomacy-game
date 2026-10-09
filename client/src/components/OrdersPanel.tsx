import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { api } from '../api/client';
import type { SceneArrow } from './MapScene';
import type { Unit } from '../types/domain';

function describeOrder(o: ReturnType<typeof useGameStore.getState>['draftOrders'][string]): string {
  switch (o.kind) {
    case 'hold':
      return `Hold`;
    case 'move':
      return `Move → ${o.to?.toUpperCase()}`;
    case 'support-hold':
      return `Support ${o.targetProvince?.toUpperCase()} to hold`;
    case 'support-move':
      return `Support ${o.targetProvince?.toUpperCase()} → ${o.to?.toUpperCase()}`;
    case 'convoy':
      return `Convoy ${o.armyProvince?.toUpperCase()} → ${o.to?.toUpperCase()}`;
  }
}

export function OrdersPanel({ onPreview }: { onPreview: (frame: { units: Unit[]; arrows: SceneArrow[]; label: string } | null) => void }) {
  const { game, myPower, myUnits, selectedUnit, pendingAction, supportStage, draftOrders, setPendingAction, clearDraftFor, clearAllDrafts, setGame } =
    useGameStore();
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!game || !myPower) return <div className="panel-empty">Pick a power to play as.</div>;

  const units = myUnits();
  const canOrder = game.phase === 'orders';

  async function preview() {
    if (!game || !myPower) return;
    setPreviewing(true);
    setError(null);
    try {
      const orders = units.map((u) => draftOrders[u.province] ?? { kind: 'hold', province: u.province });
      const result = await api.hypothetical(game.id, myPower, orders);
      const arrows: SceneArrow[] = result.resolved
        .filter((r) => r.order.kind === 'move' && r.order.to)
        .map((r) => ({
          from: r.order.unit.province,
          to: r.order.to!,
          color: r.outcome === 'succeeded' ? '#8ad1ff' : r.outcome === 'dislodged' ? '#ff6b6b' : '#ffb14e',
          dashed: r.outcome !== 'succeeded',
        }));
      onPreview({ units: result.units, arrows, label: 'Hypothetical preview (not submitted)' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  }

  async function submit() {
    if (!game || !myPower) return;
    setSubmitting(true);
    setError(null);
    try {
      const orders = units.map((u) => draftOrders[u.province] ?? { kind: 'hold', province: u.province });
      const updated = await api.submitOrders(game.id, myPower, orders);
      setGame(updated);
      clearAllDrafts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="orders-panel">
      <h3>Orders — {game.season} {game.year}</h3>
      {!canOrder && <p className="muted">Waiting on {game.phase} phase (see that panel).</p>}
      {canOrder && (
        <>
          <p className="muted">
            {selectedUnit
              ? pendingAction
                ? supportStage === 'pick-target'
                  ? 'Click the unit to support/convoy.'
                  : supportStage === 'pick-destination'
                    ? 'Click the destination province.'
                    : 'Click the destination province.'
                : 'Choose an action for the selected unit.'
              : 'Click one of your units on the map to begin.'}
          </p>
          {selectedUnit && !pendingAction && (
            <div className="action-buttons">
              <button onClick={() => setPendingAction('move')}>Move</button>
              <button onClick={() => setPendingAction('support')}>Support</button>
              <button onClick={() => setPendingAction('convoy')}>Convoy</button>
              <button
                onClick={() => {
                  useGameStore.setState((s) => ({
                    draftOrders: { ...s.draftOrders, [selectedUnit]: { kind: 'hold', province: selectedUnit } },
                    selectedUnit: null,
                  }));
                }}
              >
                Hold
              </button>
            </div>
          )}

          <ul className="order-list">
            {units.map((u) => {
              const draft = draftOrders[u.province];
              return (
                <li key={u.province}>
                  <span className="order-unit">{u.type} {u.province.toUpperCase()}</span>
                  <span className="order-desc">{draft ? describeOrder(draft) : 'Hold (default)'}</span>
                  {draft && (
                    <button className="link" onClick={() => clearDraftFor(u.province)}>
                      clear
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {error && <p className="error">{error}</p>}
          <div className="action-buttons">
            <button disabled={previewing} onClick={preview}>
              {previewing ? 'Previewing…' : 'Preview outcome'}
            </button>
            <button onClick={() => onPreview(null)}>Clear preview</button>
          </div>
          <button className="primary" disabled={submitting} onClick={submit}>
            {submitting ? 'Submitting…' : 'Submit orders'}
          </button>
        </>
      )}
    </div>
  );
}
