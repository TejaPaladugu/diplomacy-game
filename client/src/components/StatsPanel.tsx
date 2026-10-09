import { useEffect, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGameStore } from '../store/gameStore';
import { api } from '../api/client';
import { POWER_COLORS, POWERS } from '../types/domain';
import type { StatsSeries } from '../types/domain';

export function StatsPanel() {
  const { game, players } = useGameStore();
  const [stats, setStats] = useState<StatsSeries | null>(null);

  useEffect(() => {
    if (!game) return;
    api.getStats(game.id).then(setStats);
  }, [game, game?.season, game?.year, game?.phase]);

  if (!game) return null;

  const scCounts = new Map<string, number>();
  for (const owner of Object.values(game.supplyCenters)) scCounts.set(owner, (scCounts.get(owner) ?? 0) + 1);
  const unitCounts = new Map<string, number>();
  for (const u of game.units) unitCounts.set(u.power, (unitCounts.get(u.power) ?? 0) + 1);

  const chartData =
    stats &&
    (() => {
      const maxLen = Math.max(...POWERS.map((p) => stats[p]?.length ?? 0), 0);
      const rows = [];
      for (let i = 0; i < maxLen; i++) {
        const row: Record<string, number | string> = {
          label: stats[POWERS[0]]?.[i] ? `${stats[POWERS[0]][i].season[0]}${stats[POWERS[0]][i].year}` : i,
        };
        for (const p of POWERS) row[p] = stats[p]?.[i]?.supplyCenters ?? null;
        rows.push(row);
      }
      return rows;
    })();

  return (
    <div className="stats-panel">
      <h3>Standings</h3>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Power</th>
            <th>Player</th>
            <th>Centers</th>
            <th>Units</th>
          </tr>
        </thead>
        <tbody>
          {POWERS.map((p) => {
            const player = players.find((pl) => pl.power === p);
            return (
              <tr key={p} style={{ color: POWER_COLORS[p] }}>
                <td>{p}</td>
                <td>{player?.name ?? '-'}{player?.eliminated ? ' (out)' : ''}</td>
                <td>{scCounts.get(p) ?? 0}</td>
                <td>{unitCounts.get(p) ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {chartData && chartData.length > 1 && (
        <div style={{ width: '100%', height: 220, marginTop: 12 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3140" />
              <XAxis dataKey="label" stroke="#8a93a6" fontSize={11} />
              <YAxis stroke="#8a93a6" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1a212e', border: '1px solid #2a3140' }} />
              <Legend />
              {POWERS.map((p) => (
                <Line key={p} type="monotone" dataKey={p} stroke={POWER_COLORS[p]} dot={false} strokeWidth={2} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
