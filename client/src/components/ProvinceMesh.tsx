import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { MapCell } from '../map/voronoi';
import { provinceHeight, provinceTint, toWorld } from '../map/terrain';
import type { TerrainMode } from '../store/gameStore';
import { POWER_COLORS } from '../types/domain';

const NEUTRAL_LAND = '#dfcea2';
const SEA_COLOR = '#a9c7ae';
const TINT_FACTORS: Record<number, number> = { 0: 1, 1: 0.86, 2: 0.94, 3: 1 };

interface Props {
  cell: MapCell;
  owner?: string;
  selected: boolean;
  terrainMode: TerrainMode;
  onClick: (province: string) => void;
}

export function ProvinceMesh({ cell, owner, selected, terrainMode, onClick }: Props) {
  const { province, polygon } = cell;
  const isSea = province.type === 'sea';
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    if (polygon.length < 3) return null;
    const height = provinceHeight(province.id, province.type, terrainMode);
    const shapePoints = polygon.map(([x, y]) => {
      const [wx, wz] = toWorld(x, y);
      return new THREE.Vector2(wx, -wz);
    });
    const shape = new THREE.Shape(shapePoints);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }, [polygon, province.id, province.type, terrainMode]);

  const baseColor = useMemo(() => {
    if (isSea) return SEA_COLOR;
    const ownerColor = owner ? POWER_COLORS[owner as keyof typeof POWER_COLORS] : undefined;
    const hex = ownerColor ?? NEUTRAL_LAND;
    const factor = terrainMode === 'relief' ? (TINT_FACTORS[provinceTint(province.id, province.type)] ?? 1) : 1;
    const c = new THREE.Color(hex);
    c.multiplyScalar(factor);
    return `#${c.getHexString()}`;
  }, [isSea, owner, province.id, province.type, terrainMode]);

  useFrame(({ clock }) => {
    if (isSea && meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const pulse = 0.05 * Math.sin(clock.elapsedTime * 0.5 + hashOf(province.id));
      mat.emissiveIntensity = 0.08 + pulse;
    }
  });

  const outline = useMemo(() => {
    const height = provinceHeight(province.id, province.type, terrainMode);
    return polygon.map(([x, y]) => {
      const [wx, wz] = toWorld(x, y);
      return [wx, height + 0.02, wz] as [number, number, number];
    });
  }, [polygon, province.id, province.type, terrainMode]);

  if (!geometry) return null;

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        position={[0, 0, 0]}
        onPointerUp={(e) => {
          e.stopPropagation();
          onClick(province.id);
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
        castShadow={!isSea}
        receiveShadow
      >
        <meshStandardMaterial
          color={selected ? '#f0c04a' : baseColor}
          emissive={isSea ? new THREE.Color(SEA_COLOR) : new THREE.Color('#000000')}
          emissiveIntensity={isSea ? 0.08 : 0}
          roughness={isSea ? 0.5 : 0.9}
          metalness={0}
        />
      </mesh>
      {outline.length > 1 && !isSea && (
        <Line points={[...outline, outline[0]]} color="#6b5a3a" lineWidth={0.6} transparent opacity={0.55} />
      )}
    </group>
  );
}

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return h / 1000;
}
