import * as THREE from 'three';

const TABLE_COLOR = '#4a3420';
const TABLE_EDGE_COLOR = '#3a2816';
const FLOOR_COLOR = '#2b2318';
const WALL_COLOR = '#473c2e';

/**
 * The board's physical surroundings, rendered as real 3D geometry rather than a CSS
 * backdrop: a wood table the map sits on, and a simple enclosing room beyond it. The room
 * is deliberately plain - it only needs to read as "a space" once thrown out of focus by
 * the depth-of-field effect in MapScene.tsx, which keeps the board itself sharp.
 */
export function TableAndRoom() {
  return (
    <group>
      {/* Wood table slab the painted board rests on - sized to show a visible margin of
          wood beyond the world backdrop's coastline from any tilted camera angle. */}
      <mesh position={[0, -1.1, 0]} receiveShadow>
        <boxGeometry args={[108, 2, 84]} />
        <meshStandardMaterial color={TABLE_COLOR} roughness={0.7} metalness={0.08} />
      </mesh>
      <mesh position={[0, -2.15, 0]} receiveShadow>
        <boxGeometry args={[108, 0.1, 84]} />
        <meshStandardMaterial color={TABLE_EDGE_COLOR} roughness={0.85} />
      </mesh>

      {/* Floor beyond the table. */}
      <mesh position={[0, -2.3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[210, 48]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={1} />
      </mesh>

      {/* A plain enclosing room - stays inside the fog/DOF falloff so it never needs to
          look like more than a soft, out-of-focus sense of walls around the board. */}
      <mesh position={[0, 60, 0]}>
        <cylinderGeometry args={[200, 200, 180, 48, 1, true]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={1} side={THREE.BackSide} fog />
      </mesh>
    </group>
  );
}
