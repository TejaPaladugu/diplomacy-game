import { useMemo } from 'react';
import * as THREE from 'three';
import { WORLD_LAND_RINGS } from '../map/voronoi';
import { toWorld } from '../map/terrain';

const BACKDROP_COLOR = '#cdbf9c';
const BACKDROP_HEIGHT = 0.08;

/**
 * Renders the real coastline of the surrounding world (deep Russia, the Sahara, etc.)
 * as a muted, non-interactive backdrop beneath/around the 75 playable provinces, so the
 * map reads as sitting within an actual continent rather than floating in open water.
 */
export function WorldBackdrop() {
  const geometry = useMemo(() => {
    const shapes = WORLD_LAND_RINGS.map((ring) => {
      const pts = ring.map(([x, y]) => {
        const [wx, wz] = toWorld(x, y);
        return new THREE.Vector2(wx, -wz);
      });
      return new THREE.Shape(pts);
    });
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: BACKDROP_HEIGHT, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} position={[0, -0.02, 0]} receiveShadow>
      <meshStandardMaterial color={BACKDROP_COLOR} roughness={0.95} />
    </mesh>
  );
}
