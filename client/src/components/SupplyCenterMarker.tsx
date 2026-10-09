import * as THREE from 'three';
import type { Power } from '../types/domain';
import { POWER_COLORS } from '../types/domain';

export function SupplyCenterMarker({ position, owner }: { position: [number, number, number]; owner?: Power }) {
  const color = owner ? POWER_COLORS[owner] : '#f2e6c9';
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.3, 0.5, 5]} />
      <meshStandardMaterial color={color} emissive={new THREE.Color(color)} emissiveIntensity={0.25} side={THREE.DoubleSide} />
    </mesh>
  );
}
