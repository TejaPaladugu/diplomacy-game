import { useEffect, useRef, useState } from 'react';
import type { Power, TurnHistoryEntry, Unit, UnitType } from '../types/domain';
import { geoXY } from '../map/voronoi';

export interface PlaybackUnit {
  key: string;
  power: Power;
  type: UnitType;
  from: [number, number];
  to: [number, number];
  /** Dislodged units animate toward their attacker's square and sink/fade out. */
  dislodged: boolean;
  /** Bounced units visually push toward the contested square and spring back. */
  bounced: boolean;
}

/** Builds one movement track per unit present at the start of the turn, from the
 * adjudicator's resolved-order data, in real-geography coordinates. */
export function buildPlaybackUnits(turn: TurnHistoryEntry): PlaybackUnit[] {
  return turn.unitsBefore.map((u: Unit) => {
    const from = geoXY(u.province, [0, 0]);
    const resolved = turn.resolved.find((r) => r.order.unit.province === u.province);
    const outcome = resolved?.outcome;
    const moveTarget = resolved?.order.kind === 'move' ? resolved.order.to : undefined;

    if (outcome === 'succeeded' && moveTarget) {
      return { key: u.province, power: u.power, type: u.type, from, to: geoXY(moveTarget, from), dislodged: false, bounced: false };
    }
    if (outcome === 'dislodged') {
      const attacker = resolved?.dislodgedBy;
      const to = attacker ? geoXY(attacker, from) : from;
      return { key: u.province, power: u.power, type: u.type, from, to, dislodged: true, bounced: false };
    }
    if (outcome === 'bounced' && moveTarget) {
      return { key: u.province, power: u.power, type: u.type, from, to: geoXY(moveTarget, from), dislodged: false, bounced: true };
    }
    return { key: u.province, power: u.power, type: u.type, from, to: from, dislodged: false, bounced: false };
  });
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Drives a 0-1 playback clock via requestAnimationFrame whenever `active` is true,
 * resetting to 0 each time it newly becomes active. Stays at 1 once finished.
 *
 * Always starts at 0 (even while inactive) rather than seeding from `active`: a
 * sibling effect that reads this value in the same render where `active` flips to
 * true would otherwise see a stale "already finished" value from before the reset
 * effect below has had a chance to run. */
export function usePlaybackClock(active: boolean, durationMs: number): number {
  const [t, setT] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    startRef.current = null;
    setT(0);
    function tick(now: number) {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const next = Math.min(1, elapsed / durationMs);
      setT(next);
      if (next < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, durationMs]);

  return t;
}

export interface AnimatedUnitFrame {
  key: string;
  power: Power;
  type: UnitType;
  x: number;
  y: number;
  opacity: number;
  /** 0-1 "how far into a hop" for a subtle rise during movement, 0 when stationary. */
  arc: number;
}

/** Interpolates playback tracks at time t (0-1), handling dislodge fade-out and
 * bounce push-and-return as distinct easing shapes. */
export function sampleTurnPlayback(units: PlaybackUnit[], t: number): AnimatedUnitFrame[] {
  return units.map((u) => {
    if (u.bounced) {
      // push toward the contested square for the first 60%, spring back for the rest
      const bt = t < 0.6 ? easeInOutCubic(t / 0.6) * 0.4 : (1 - easeInOutCubic((t - 0.6) / 0.4)) * 0.4;
      return { key: u.key, power: u.power, type: u.type, x: lerp(u.from[0], u.to[0], bt), y: lerp(u.from[1], u.to[1], bt), opacity: 1, arc: Math.sin(bt * Math.PI * 2.5) * 0.5 };
    }
    if (u.dislodged) {
      const dt = easeInOutCubic(Math.min(1, t / 0.75));
      const opacity = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      return {
        key: u.key,
        power: u.power,
        type: u.type,
        x: lerp(u.from[0], u.to[0], dt * 0.55),
        y: lerp(u.from[1], u.to[1], dt * 0.55),
        opacity: Math.max(0, opacity),
        arc: 0,
      };
    }
    const mt = easeInOutCubic(t);
    return { key: u.key, power: u.power, type: u.type, x: lerp(u.from[0], u.to[0], mt), y: lerp(u.from[1], u.to[1], mt), opacity: 1, arc: Math.sin(mt * Math.PI) };
  });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
