import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ProvinceMesh } from './ProvinceMesh';
import { WorldBackdrop } from './WorldBackdrop';
import { UnitToken } from './UnitToken';
import { SupplyCenterMarker } from './SupplyCenterMarker';
import { OrderArrow } from './OrderArrow';
import { CameraRig } from './CameraRig';
import { useGameStore } from '../store/gameStore';
import { provinceHeight, toWorld } from '../map/terrain';
import { geoXY } from '../map/voronoi';
import type { Unit } from '../types/domain';
import type { AnimatedUnitFrame } from '../hooks/useTurnPlayback';

export interface SceneArrow {
  from: string;
  to: string;
  color?: string;
  dashed?: boolean;
}

interface Props {
  displayUnits?: Unit[];
  /** When provided, overrides displayUnits entirely and positions units at continuous
   * (x,y) coordinates rather than snapped to a province - used for turn animations. */
  animatedUnits?: AnimatedUnitFrame[];
  arrows?: SceneArrow[];
  interactive?: boolean;
}

export function MapScene({ displayUnits, animatedUnits, arrows = [], interactive = true }: Props) {
  const { cells, game, byId, viewMode, terrainMode, selectedUnit, myPower, draftOrders, handleProvinceClick, selectUnit } = useGameStore();

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
    <Canvas shadows dpr={[1, 2]} style={{ width: '100%', height: '100%', background: '#8fb3c7' }}>
      <CameraRig viewMode={viewMode} />
      <ambientLight intensity={0.65} color="#fff6e0" />
      <directionalLight position={[30, 50, 20]} intensity={1.05} color="#fff2d8" castShadow shadow-mapSize={[2048, 2048]} />
      <hemisphereLight args={['#bcd4c4', '#4a3f2a', 0.45]} />
      <fog attach="fog" args={[new THREE.Color('#9fc0b8').getHex(), 90, 230]} />

      <WorldBackdrop />

      {cells.map((cell) => (
        <ProvinceMesh
          key={cell.province.id}
          cell={cell}
          owner={game?.supplyCenters[cell.province.id]}
          selected={selectedUnit === cell.province.id}
          terrainMode={terrainMode}
          onClick={handleClick}
        />
      ))}

      {cells
        .filter((c) => c.province.supplyCenter)
        .map((c) => {
          const [gx, gy] = geoXY(c.province.id, [c.province.x, c.province.y]);
          const [x, z] = toWorld(gx, gy);
          const h = provinceHeight(c.province.id, c.province.type, terrainMode);
          return <SupplyCenterMarker key={c.province.id} position={[x, h + 0.01, z]} owner={game?.supplyCenters[c.province.id]} />;
        })}

      {cells
        .filter((c) => c.province.type === 'land')
        .map((c) => {
          const [gx, gy] = geoXY(c.province.id, [c.province.x, c.province.y]);
          const [x, z] = toWorld(gx, gy);
          const h = provinceHeight(c.province.id, c.province.type, terrainMode);
          return (
            <Html key={`label-${c.province.id}`} position={[x, h + 0.05, z]} center occlude={false} zIndexRange={[1, 0]} pointerEvents="none">
              <div className="province-label">{c.province.name}</div>
            </Html>
          );
        })}

      {cells
        .filter((c) => c.province.type === 'sea')
        .map((c) => {
          const [gx, gy] = geoXY(c.province.id, [c.province.x, c.province.y]);
          const [x, z] = toWorld(gx, gy);
          return (
            <Html key={`sea-label-${c.province.id}`} position={[x, 0.18, z]} center occlude={false} zIndexRange={[1, 0]} pointerEvents="none">
              <div className="province-label sea-label">{c.province.name}</div>
            </Html>
          );
        })}

      {animatedUnits
        ? animatedUnits.map((a) => {
            const [x, z] = toWorld(a.x, a.y);
            return (
              <UnitToken
                key={a.key}
                power={a.power}
                type={a.type}
                position={[x, 1.1 + a.arc * 0.9, z]}
                selected={false}
                opacity={a.opacity}
              />
            );
          })
        : units.map((u) => {
            const p = byId[u.province];
            if (!p) return null;
            const [gx, gy] = geoXY(u.province, [p.x, p.y]);
            const [x, z] = toWorld(gx, gy);
            const h = provinceHeight(p.id, p.type, terrainMode);
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
        const [fgx, fgy] = geoXY(a.from, [from.x, from.y]);
        const [tgx, tgy] = geoXY(a.to, [to.x, to.y]);
        const [fx, fz] = toWorld(fgx, fgy);
        const [tx, tz] = toWorld(tgx, tgy);
        return <OrderArrow key={i} from={[fx, 0, fz]} to={[tx, 0, tz]} color={a.color} dashed={a.dashed} />;
      })}
    </Canvas>
  );
}
