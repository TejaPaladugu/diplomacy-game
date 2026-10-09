import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { MapCell } from '../map/voronoi';
import { provinceHeight, provinceTintFactor, provinceVertexHeights, toWorld } from '../map/terrain';
import type { TerrainMode } from '../store/gameStore';
import { POWER_COLORS } from '../types/domain';

const NEUTRAL_LAND = '#dfcea2';
const SEA_COLOR = '#a9c7ae';
const DIMMED_COLOR = '#55503f';

// Owned territory reads as a richer, more saturated shade of the power's color rather
// than the flat swatch used in UI chrome, so ownership is unmistakable at a glance.
function ownerShade(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * 1.35 + 0.08), Math.max(0, hsl.l * 0.86));
  return c;
}

// A province merely occupied by a unit (no supply-center ownership) gets a much lighter
// tint of that power's color - present, but visually distinct from outright control.
function occupantShade(hex: string): THREE.Color {
  return new THREE.Color(hex).lerp(new THREE.Color(NEUTRAL_LAND), 0.6);
}

interface Props {
  cell: MapCell;
  owner?: string;
  /** A power whose unit occupies this province without owning it (ownership mode only). */
  occupantTint?: string;
  /** "Highlight mine only": true dims this province toward a neutral grey. */
  dimmed?: boolean;
  selected: boolean;
  terrainMode: TerrainMode;
  onClick: (province: string) => void;
}

export function ProvinceMesh({ cell, owner, occupantTint, dimmed, selected, terrainMode, onClick }: Props) {
  const { province, polygon } = cell;
  const isSea = province.type === 'sea';
  const meshRef = useRef<THREE.Mesh>(null);

  // A per-vertex top height (real elevation data in relief mode, see terrain.ts) rather
  // than one flat number for the whole province, so the land actually undulates -
  // ridgelines and slopes instead of a uniform block.
  const topHeights = useMemo(() => {
    const n = polygon.length;
    const verts = provinceVertexHeights(province.id, terrainMode, n);
    if (verts) return verts;
    const h = provinceHeight(province.id, province.type, terrainMode);
    return new Array(n).fill(h);
  }, [polygon, province.id, province.type, terrainMode]);

  const geometry = useMemo(() => {
    const n = polygon.length;
    if (n < 3) return null;
    const shapePoints = polygon.map(([x, y]) => {
      const [wx, wz] = toWorld(x, y);
      return new THREE.Vector2(wx, -wz);
    });
    const triangles = THREE.ShapeUtils.triangulateShape(shapePoints, []);

    const positions = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i++) {
      const p = shapePoints[i];
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = topHeights[i];
      positions[i * 3 + 2] = -p.y;
      const bi = n + i;
      positions[bi * 3] = p.x;
      positions[bi * 3 + 1] = 0;
      positions[bi * 3 + 2] = -p.y;
    }

    const indices: number[] = [];
    for (const [a, b, c] of triangles) indices.push(a, b, c); // top cap
    for (const [a, b, c] of triangles) indices.push(n + c, n + b, n + a); // bottom cap, reversed
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      indices.push(i, n + i, n + j); // side wall quad
      indices.push(i, n + j, j);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [polygon, topHeights]);

  const baseColor = useMemo(() => {
    if (isSea) {
      const c = new THREE.Color(SEA_COLOR);
      if (dimmed) c.lerp(new THREE.Color(DIMMED_COLOR), 0.55);
      return `#${c.getHexString()}`;
    }
    let c: THREE.Color;
    if (owner) c = ownerShade(POWER_COLORS[owner as keyof typeof POWER_COLORS]);
    else if (occupantTint) c = occupantShade(POWER_COLORS[occupantTint as keyof typeof POWER_COLORS]);
    else c = new THREE.Color(NEUTRAL_LAND);
    const factor = terrainMode === 'relief' ? provinceTintFactor(province.id, province.type) : 1;
    c.multiplyScalar(factor);
    if (dimmed) c.lerp(new THREE.Color(DIMMED_COLOR), 0.72);
    return `#${c.getHexString()}`;
  }, [isSea, owner, occupantTint, dimmed, province.id, province.type, terrainMode]);

  useFrame(({ clock }) => {
    if (isSea && meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const pulse = 0.05 * Math.sin(clock.elapsedTime * 0.5 + hashOf(province.id));
      mat.emissiveIntensity = 0.08 + pulse;
    }
  });

  const outline = useMemo(() => {
    return polygon.map(([x, y], i) => {
      const [wx, wz] = toWorld(x, y);
      return [wx, (topHeights[i] ?? 0) + 0.02, wz] as [number, number, number];
    });
  }, [polygon, topHeights]);

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
