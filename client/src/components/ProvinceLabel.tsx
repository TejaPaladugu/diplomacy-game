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
// Below this on-screen "size" (world-space radius * zoom) a label starts shrinking and
// fading rather than popping off outright - small, closely-packed provinces (central
// Europe especially) ease out of the way as you zoom out instead of cluttering the full
// map view, and ease back in smoothly as you zoom in, rather than snapping in size.
const FADE_START = 3.2;
const FADE_END = 1.1;
const MIN_SCALE = 0.3;

/** A province/sea name rendered as real 3D text (not a DOM overlay), so it naturally
 * scales up when the camera zooms in and down when it zooms out, in every view mode -
 * and continuously shrinks/fades (rather than a hard cutoff) below a size threshold so
 * small, closely-packed provinces don't clutter the map until zoomed in enough to read
 * without overlap. Depth-testing is off so the label always reads clearly on top of
 * terrain or unit tokens regardless of camera angle, instead of clipping into the ground
 * or getting hidden behind a piece standing on the same province. */
export function ProvinceLabel({ position, text, radius, sea }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    const ortho = camera as THREE.OrthographicCamera;
    const zoomFactor = ortho.isOrthographicCamera ? ortho.zoom : BASE_PERSPECTIVE_DISTANCE / Math.max(1, camera.position.length());
    const visualSize = radius * zoomFactor;
    const t = Math.max(0, Math.min(1, (visualSize - FADE_END) / (FADE_START - FADE_END)));
    const scale = MIN_SCALE + t * (1 - MIN_SCALE);
    groupRef.current.visible = t > 0.02;
    groupRef.current.scale.setScalar(scale);
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
          depthOffset={-100}
          renderOrder={10}
          material-depthTest={false}
          material-transparent={true}
        >
          {text}
        </Text>
      </Billboard>
    </group>
  );
}
