import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Power, UnitType } from '../types/domain';
import { POWER_COLORS } from '../types/domain';

type OrnamentKind = 'torus' | 'box' | 'cone' | 'octahedron' | 'icosahedron' | 'dodecahedron' | 'torusKnot';

// Each power gets a distinct "crest" silhouette on top of a shared pawn/ship base, so a
// token reads as that nation's unit at a glance regardless of Army vs Fleet.
const POWER_ORNAMENT: Record<Power, OrnamentKind> = {
  AUSTRIA: 'torus',
  ENGLAND: 'box',
  FRANCE: 'cone',
  GERMANY: 'octahedron',
  ITALY: 'icosahedron',
  RUSSIA: 'dodecahedron',
  TURKEY: 'torusKnot',
};

function Ornament({ kind, color }: { kind: OrnamentKind; color: string }) {
  const material = <meshStandardMaterial color={color} roughness={0.35} metalness={0.4} />;
  switch (kind) {
    case 'torus':
      return (
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.22, 0.07, 10, 20]} />
          {material}
        </mesh>
      );
    case 'box':
      return (
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          {material}
        </mesh>
      );
    case 'cone':
      return (
        <mesh castShadow>
          <coneGeometry args={[0.2, 0.4, 8]} />
          {material}
        </mesh>
      );
    case 'octahedron':
      return (
        <mesh castShadow>
          <octahedronGeometry args={[0.24]} />
          {material}
        </mesh>
      );
    case 'icosahedron':
      return (
        <mesh castShadow>
          <icosahedronGeometry args={[0.22]} />
          {material}
        </mesh>
      );
    case 'dodecahedron':
      return (
        <mesh castShadow>
          <dodecahedronGeometry args={[0.22]} />
          {material}
        </mesh>
      );
    case 'torusKnot':
      return (
        <mesh castShadow scale={0.55}>
          <torusKnotGeometry args={[0.2, 0.06, 40, 8]} />
          {material}
        </mesh>
      );
  }
}

interface Props {
  power: Power;
  type: UnitType;
  position: [number, number, number];
  selected: boolean;
  dimmed?: boolean;
  opacity?: number;
  onClick?: () => void;
}

export function UnitToken({ power, type, position, selected, dimmed, opacity, onClick }: Props) {
  const color = POWER_COLORS[power];
  const ornament = POWER_ORNAMENT[power];
  const groupRef = useRef<THREE.Group>(null);
  const effectiveOpacity = opacity ?? (dimmed ? 0.45 : 1);

  const bobPhase = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(({ clock }) => {
    if (groupRef.current && selected) {
      groupRef.current.position.y = position[1] + 0.08 + Math.sin(clock.elapsedTime * 3 + bobPhase) * 0.05;
    } else if (groupRef.current) {
      groupRef.current.position.y = position[1];
    }
  });

  const baseMaterial = (
    <meshStandardMaterial color={color} roughness={0.55} metalness={0.15} opacity={effectiveOpacity} transparent={effectiveOpacity < 1} />
  );

  return (
    <group
      ref={groupRef}
      position={position}
      scale={2.1}
      onPointerUp={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {selected && (
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.46, 24]} />
          <meshBasicMaterial color="#ffe08a" />
        </mesh>
      )}
      {type === 'A' ? (
        <>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.17, 0.36, 10]} />
            {baseMaterial}
          </mesh>
          <mesh position={[0, 0.42, 0]} castShadow>
            <coneGeometry args={[0.15, 0.3, 10]} />
            {baseMaterial}
          </mesh>
          <group position={[0, 0.62, 0]}>
            <Ornament kind={ornament} color={color} />
          </group>
        </>
      ) : (
        <>
          <mesh position={[0, 0.12, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.42, 4, 8]} />
            {baseMaterial}
          </mesh>
          <mesh position={[0, 0.18, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.015, 0.015, 0.42, 6]} />
            <meshStandardMaterial color="#3a2a1a" />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.34, 6]} />
            <meshStandardMaterial color="#3a2a1a" />
          </mesh>
          <group position={[0, 0.5, 0]}>
            <Ornament kind={ornament} color={color} />
          </group>
        </>
      )}
    </group>
  );
}
