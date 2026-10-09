import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { MapCell } from '../map/voronoi';
import { provinceHeight, provinceTint, toWorld } from '../map/terrain';
import { POWER_COLORS } from '../types/domain';

const NEUTRAL_LAND = '#c9bd9a';
const SEA_COLOR = '#2a5f8a';
const TINT_FACTORS: Record<number, number> = { 0: 1, 1: 0.78, 2: 0.9, 3: 1 };

interface Props {
  cell: MapCell;
  owner?: string;
  selected: boolean;
  highlighted: boolean;
  onClick: (province: string) => void;
}

export function ProvinceMesh({ cell, owner, selected, highlighted, onClick }: Props) {
  const { province, polygon } = cell;
  const isSea = province.type === 'sea';
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    if (polygon.length < 3) return null;
    const height = provinceHeight(province.id, province.type);
    const shapePoints = polygon.map(([x, y]) => {
      const [wx, wz] = toWorld(x, y);
      return new THREE.Vector2(wx, -wz);
    });
    const shape = new THREE.Shape(shapePoints);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }, [polygon, province.id, province.type]);

  const baseColor = useMemo(() => {
    if (isSea) return SEA_COLOR;
    const ownerColor = owner ? POWER_COLORS[owner as keyof typeof POWER_COLORS] : undefined;
    const hex = ownerColor ?? NEUTRAL_LAND;
    const factor = TINT_FACTORS[provinceTint(province.id, province.type)] ?? 1;
    const c = new THREE.Color(hex);
    c.multiplyScalar(factor);
    return `#${c.getHexString()}`;
  }, [isSea, owner, province.id, province.type]);

  useFrame(({ clock }) => {
    if (isSea && meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const pulse = 0.08 * Math.sin(clock.elapsedTime * 0.6 + hashOf(province.id));
      mat.emissiveIntensity = 0.15 + pulse;
    }
  });

  const outline = useMemo(() => {
    const height = provinceHeight(province.id, province.type);
    return polygon.map(([x, y]) => {
      const [wx, wz] = toWorld(x, y);
      return [wx, height + 0.02, wz] as [number, number, number];
    });
  }, [polygon, province.id, province.type]);

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
          color={selected ? '#ffe08a' : highlighted ? '#ffffff' : baseColor}
          emissive={isSea ? new THREE.Color(SEA_COLOR) : new THREE.Color('#000000')}
          emissiveIntensity={isSea ? 0.15 : 0}
          roughness={isSea ? 0.3 : 0.85}
          metalness={isSea ? 0.2 : 0}
        />
      </mesh>
      {outline.length > 1 && <Line points={[...outline, outline[0]]} color={isSea ? '#163a52' : '#5a4a30'} lineWidth={1} />}
    </group>
  );
}

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return h / 1000;
}
