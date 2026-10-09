import type { SceneArrow } from '../components/MapScene';
import type { TurnHistoryEntry } from '../types/domain';

export function arrowsForTurn(turn: TurnHistoryEntry): SceneArrow[] {
  return turn.resolved
    .filter((r) => r.order.kind === 'move' && r.order.to)
    .map((r) => ({
      from: r.order.unit.province,
      to: r.order.to!,
      color: r.outcome === 'succeeded' ? '#8ad1ff' : r.outcome === 'dislodged' ? '#ff6b6b' : '#ffb14e',
      dashed: r.outcome !== 'succeeded',
    }));
}
