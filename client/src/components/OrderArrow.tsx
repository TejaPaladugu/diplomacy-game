import { useMemo } from 'react';
import * as THREE from 'three';

interface Props {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  dashed?: boolean;
  height?: number;
}

export function OrderArrow({ from, to, color = '#ffe08a', dashed = false, height = 2.3 }: Props) {
  const { shaftGeom, headPos, headQuat, shaftPos, shaftQuat } = useMemo(() => {
    const a = new THREE.Vector3(from[0], height, from[2]);
    const b = new THREE.Vector3(to[0], height, to[2]);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const headLen = Math.min(1.2, len * 0.3);
    const shaftLen = Math.max(len - headLen, 0.01);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const shaftCenter = a.clone().add(dir.clone().normalize().multiplyScalar(shaftLen / 2));
    const headCenter = a.clone().add(dir.clone().normalize().multiplyScalar(shaftLen + headLen / 2));
    return {
      shaftGeom: [0.085, 0.085, shaftLen, 6] as [number, number, number, number],
      shaftPos: shaftCenter,
      shaftQuat: quat,
      headPos: headCenter,
      headQuat: quat,
    };
  }, [from, to, height]);

  return (
    <group>
      <mesh position={shaftPos} quaternion={shaftQuat}>
        <cylinderGeometry args={shaftGeom} />
        <meshStandardMaterial color={color} emissive={new THREE.Color(color)} emissiveIntensity={0.4} transparent opacity={dashed ? 0.55 : 0.9} />
      </mesh>
      <mesh position={headPos} quaternion={headQuat}>
        <coneGeometry args={[0.33, 1.0, 8]} />
        <meshStandardMaterial color={color} emissive={new THREE.Color(color)} emissiveIntensity={0.4} transparent opacity={dashed ? 0.55 : 0.9} />
      </mesh>
    </group>
  );
}
