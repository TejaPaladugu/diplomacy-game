import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { ProvinceMesh } from './ProvinceMesh';
import { UnitToken } from './UnitToken';
import { SupplyCenterMarker } from './SupplyCenterMarker';
import { OrderArrow } from './OrderArrow';
import { CameraRig } from './CameraRig';
import { useGameStore } from '../store/gameStore';
import { provinceHeight, toWorld } from '../map/terrain';
import type { Unit } from '../types/domain';

export interface SceneArrow {
  from: string;
  to: string;
  color?: string;
  dashed?: boolean;
}

interface Props {
  displayUnits?: Unit[];
  arrows?: SceneArrow[];
  interactive?: boolean;
}

export function MapScene({ displayUnits, arrows = [], interactive = true }: Props) {
  const { cells, game, byId, viewMode, selectedUnit, myPower, draftOrders, handleProvinceClick, selectUnit } = useGameStore();

  const units = displayUnits ?? game?.units ?? [];

  const draftArrows: SceneArrow[] = useMemo(() => {
    const out: SceneArrow[] = [];
    for (const order of Object.values(draftOrders)) {
      if (order.kind === 'move' && order.to) out.push({ from: order.province, to: order.to, color: '#8ad1ff' });
      if (order.kind === 'support-move' && order.targetProvince && order.to)
        out.push({ from: order.province, to: order.to, color: '#9cff9c', dashed: true });
      if (order.kind === 'convoy' && order.armyProvince && order.to) out.push({ from: order.province, to: order.to, color: '#d9a8ff', dashed: true });
    }
    return out;
  }, [draftOrders]);

  function handleClick(province: string) {
    if (!interactive) return;
    if (selectedUnit && province === selectedUnit) {
      selectUnit(null);
      return;
    }
    handleProvinceClick(province);
  }

  return (
    <Canvas shadows dpr={[1, 2]} style={{ width: '100%', height: '100%', background: '#0b1622' }}>
      <CameraRig viewMode={viewMode} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[30, 50, 20]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} />
      <hemisphereLight args={['#8fb4d9', '#2a2015', 0.4]} />

      {cells.map((cell) => (
        <ProvinceMesh
          key={cell.province.id}
          cell={cell}
          owner={game?.supplyCenters[cell.province.id]}
          selected={selectedUnit === cell.province.id}
          highlighted={false}
          onClick={handleClick}
        />
      ))}

      {cells
        .filter((c) => c.province.supplyCenter)
        .map((c) => {
          const [x, z] = toWorld(c.province.x, c.province.y);
          const h = provinceHeight(c.province.id, c.province.type);
          return <SupplyCenterMarker key={c.province.id} position={[x, h + 0.01, z]} owner={game?.supplyCenters[c.province.id]} />;
        })}

      {cells
        .filter((c) => c.province.type === 'land')
        .map((c) => {
          const [x, z] = toWorld(c.province.x, c.province.y);
          const h = provinceHeight(c.province.id, c.province.type);
          return (
            <Html key={`label-${c.province.id}`} position={[x, h + 0.05, z]} center occlude={false} zIndexRange={[1, 0]} pointerEvents="none">
              <div className="province-label">{c.province.id.toUpperCase()}</div>
            </Html>
          );
        })}

      {units.map((u) => {
        const p = byId[u.province];
        if (!p) return null;
        const [x, z] = toWorld(p.x, p.y);
        const h = provinceHeight(p.id, p.type);
        return (
          <UnitToken
            key={`${u.power}-${u.province}`}
            power={u.power}
            type={u.type}
            position={[x, h, z]}
            selected={selectedUnit === u.province}
            dimmed={!!myPower && u.power !== myPower && interactive}
            onClick={() => handleClick(u.province)}
          />
        );
      })}

      {[...arrows, ...draftArrows].map((a, i) => {
        const from = byId[a.from];
        const to = byId[a.to];
        if (!from || !to) return null;
        const [fx, fz] = toWorld(from.x, from.y);
        const [tx, tz] = toWorld(to.x, to.y);
        return <OrderArrow key={i} from={[fx, 0, fz]} to={[tx, 0, tz]} color={a.color} dashed={a.dashed} />;
      })}
    </Canvas>
  );
}
