import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  position: [number, number, number];
  text: string;
  /** World-space radius of this province's cell (pixel-space radius * map SCALE). */
  radius: number;
  sea?: boolean;
}

// Reference camera distance at the default perspective framing (position [0,35,50]) -
// used so a perspective "zoomFactor" lines up with the orthographic cameras' camera.zoom,
// which both top-down and orthographic view modes drive directly via OrbitControls.
const BASE_PERSPECTIVE_DISTANCE = 61;
// Minimum on-screen "size" (world-space radius * zoom) before a label is worth showing -
// small provinces stay hidden until the player has zoomed in enough for the label to have
// room, which keeps the full-map view readable instead of a wall of overlapping text. Many
// land provinces (central Europe especially) sit shoulder to shoulder, so this needs to be
// comfortably above their resting radius at the default view, not just above zero.
const VISIBILITY_THRESHOLD = 2.1;

/** A province/sea name rendered as real 3D text (not a DOM overlay), so it naturally
 * scales up when the camera zooms in and down when it zooms out, in every view mode -
 * and fades out below a size threshold so small, closely-packed provinces don't clutter
 * the map until the player is zoomed in enough to read them without overlap. */
export function ProvinceLabel({ position, text, radius, sea }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    const ortho = camera as THREE.OrthographicCamera;
    const zoomFactor = ortho.isOrthographicCamera ? ortho.zoom : BASE_PERSPECTIVE_DISTANCE / Math.max(1, camera.position.length());
    groupRef.current.visible = radius * zoomFactor > VISIBILITY_THRESHOLD;
  });

  return (
    <group ref={groupRef} position={position}>
      <Billboard>
        <Text
          font="/fonts/eb-garamond-600.woff"
          fontSize={sea ? 1.0 : 1.15}
          color={sea ? '#3a4a42' : '#2a2015'}
          outlineWidth={0.028}
          outlineColor="#f3e9d2"
          outlineOpacity={0.9}
          anchorX="center"
          anchorY="middle"
          maxWidth={12}
          textAlign="center"
        >
          {text}
        </Text>
      </Billboard>
    </group>
  );
}
