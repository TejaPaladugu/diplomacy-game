import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Power } from '../types/domain';
import { POWER_COLORS } from '../types/domain';

const UNOWNED_COLOR = '#f2e6c9';

/** A resource center needs to read clearly even next to a standing unit and the now much
 * busier terrain/territory coloring - a raised, gently pulsing glowing beacon rather than
 * a thin flat ring that was easy to miss. */
export function SupplyCenterMarker({ position, owner }: { position: [number, number, number]; owner?: Power }) {
  const color = owner ? POWER_COLORS[owner] : UNOWNED_COLOR;
  const gemRef = useRef<THREE.Mesh>(null);
  const phase = useRef(Math.random() * Math.PI * 2).current;

  useFrame(({ clock }) => {
    const mat = gemRef.current?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) mat.emissiveIntensity = 0.55 + 0.25 * Math.sin(clock.elapsedTime * 1.8 + phase);
    if (gemRef.current) gemRef.current.rotation.y = clock.elapsedTime * 0.6 + phase;
  });

  return (
    <group position={position}>
      {/* base ring on the ground, marking the exact province */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.6, 5]} />
        <meshStandardMaterial color={color} emissive={new THREE.Color(color)} emissiveIntensity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* pedestal */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 0.44, 8]} />
        <meshStandardMaterial color="#2a2015" roughness={0.75} metalness={0.1} />
      </mesh>
      {/* glowing gem - the main visual anchor, tall enough to clear a standing unit. Self-
          illuminating via emissive only (no real-time point light - with ~34 of these on
          the board at once, per-light fragment shading got expensive enough to destabilize
          software-rendered WebGL). */}
      <mesh ref={gemRef} position={[0, 0.58, 0]} castShadow>
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color={color} emissive={new THREE.Color(color)} emissiveIntensity={0.6} roughness={0.25} metalness={0.35} />
      </mesh>
    </group>
  );
}
