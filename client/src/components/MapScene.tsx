import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import { ProvinceMesh } from './ProvinceMesh';
import { WorldBackdrop } from './WorldBackdrop';
import { TableAndRoom } from './TableAndRoom';
import { UnitToken } from './UnitToken';
import { SupplyCenterMarker } from './SupplyCenterMarker';
import { OrderArrow } from './OrderArrow';
import { ProvinceLabel } from './ProvinceLabel';
import { CameraRig } from './CameraRig';
import { useGameStore } from '../store/gameStore';
import { provinceHeight, toWorld, SCALE } from '../map/terrain';
import { geoXY, geoRadius } from '../map/voronoi';
import { computeFloodFillOwners } from '../map/territory';
import type { Power, Unit } from '../types/domain';
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
  const {
    cells,
    game,
    byId,
    viewMode,
    terrainMode,
    territoryColorMode,
    highlightMineOnly,
    shadowsEnabled,
    selectedUnit,
    myPower,
    draftOrders,
    handleProvinceClick,
    selectUnit,
  } = useGameStore();

  const units = displayUnits ?? game?.units ?? [];

  const floodFillOwners = useMemo(() => {
    if (territoryColorMode !== 'territory' || !game) return {};
    return computeFloodFillOwners(cells.map((c) => c.province), game.supplyCenters);
  }, [territoryColorMode, game, cells]);

  const occupantByProvince = useMemo(() => {
    const map: Record<string, Power> = {};
    for (const u of units) if (!map[u.province]) map[u.province] = u.power;
    return map;
  }, [units]);

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
    <Canvas shadows={shadowsEnabled} dpr={[1, 2]} style={{ width: '100%', height: '100%', background: '#8fb3c7' }}>
      <CameraRig viewMode={viewMode} />
      <ambientLight intensity={shadowsEnabled ? 0.65 : 0.85} color="#fff6e0" />
      <directionalLight
        position={[30, 50, 20]}
        intensity={1.05}
        color="#fff2d8"
        castShadow={shadowsEnabled}
        shadow-mapSize={[2048, 2048]}
      />
      <hemisphereLight args={['#bcd4c4', '#4a3f2a', 0.45]} />
      <fog attach="fog" args={[new THREE.Color('#9fc0b8').getHex(), 90, 260]} />

      <TableAndRoom />
      <WorldBackdrop />

      {cells.map((cell) => {
        const scOwner = game?.supplyCenters[cell.province.id];
        const owner = territoryColorMode === 'territory' ? floodFillOwners[cell.province.id] : scOwner;
        const occupantTint = territoryColorMode === 'ownership' ? occupantByProvince[cell.province.id] : undefined;
        const isMine = !!myPower && (owner === myPower || occupantTint === myPower);
        return (
          <ProvinceMesh
            key={cell.province.id}
            cell={cell}
            owner={owner}
            occupantTint={occupantTint}
            dimmed={highlightMineOnly && !!myPower && !isMine}
            selected={selectedUnit === cell.province.id}
            terrainMode={terrainMode}
            onClick={handleClick}
          />
        );
      })}

      {cells
        .filter((c) => c.province.supplyCenter)
        .map((c) => {
          const [gx, gy] = geoXY(c.province.id, [c.province.x, c.province.y]);
          const [x, z] = toWorld(gx, gy);
          const h = provinceHeight(c.province.id, c.province.type, terrainMode);
          // Offset from the province's exact center, which is also where a unit standing
          // there is positioned - without this the marker sits directly under/behind the
          // (much larger) unit model and all but disappears.
          return (
            <SupplyCenterMarker
              key={c.province.id}
              position={[x + 0.55, h + 0.01, z + 0.55]}
              owner={game?.supplyCenters[c.province.id]}
            />
          );
        })}

      {cells
        .filter((c) => c.province.type === 'land')
        .map((c) => {
          const [gx, gy] = geoXY(c.province.id, [c.province.x, c.province.y]);
          const [x, z] = toWorld(gx, gy);
          const h = provinceHeight(c.province.id, c.province.type, terrainMode);
          // Rest above the province's actual highest point (not just its seed-point
          // height), so the label clears real terrain variation and standing units
          // instead of sinking into a ridge or getting buried behind a tall piece.
          const peak = terrainMode === 'relief' && c.vertexElevations?.length ? Math.max(h, ...c.vertexElevations) : h;
          return (
            <ProvinceLabel
              key={`label-${c.province.id}`}
              position={[x, peak + 0.75, z]}
              text={c.province.name}
              radius={geoRadius(c.province.id) * SCALE}
            />
          );
        })}

      {cells
        .filter((c) => c.province.type === 'sea')
        .map((c) => {
          const [gx, gy] = geoXY(c.province.id, [c.province.x, c.province.y]);
          const [x, z] = toWorld(gx, gy);
          return (
            <ProvinceLabel
              key={`sea-label-${c.province.id}`}
              position={[x, 0.45, z]}
              text={c.province.name}
              radius={geoRadius(c.province.id) * SCALE}
              sea
            />
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

      {/* Keeps the board itself sharp while the table/room beyond it fall gently out of
          focus, like a shallow depth of field on a tabletop photo - the "room blurred in
          the background" effect lives here, in the actual rendering, not as a CSS blur
          layered over the UI. Perspective-only: a real orthographic lens has no depth of
          field at all, and this effect's depth math doesn't suit an orthographic camera
          (it blurred the whole board rather than just the background), so the top-down
          and orthographic views stay sharp throughout - which is also more useful for them. */}
      {viewMode === 'perspective' && (
        <EffectComposer multisampling={0}>
          <DepthOfField target={[0, 0.6, 0]} focusRange={65} bokehScale={2} resolutionScale={0.35} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
