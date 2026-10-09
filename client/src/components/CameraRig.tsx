import { useRef } from 'react';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { ViewMode } from '../store/gameStore';

// Explicit world-unit frustum, independent of CSS pixel size (drei's default frustum is
// sized in raw canvas pixels, which has nothing to do with our ~110x75 world-unit map).
const VIEW_HALF_WIDTH = 72;
const VIEW_HALF_HEIGHT = 48;

const VIEW_SETTINGS: Record<ViewMode, { position: [number, number, number]; minPolar: number; maxPolar: number }> = {
  'top-down': { position: [0, 90, 0.01], minPolar: 0, maxPolar: 0.15 },
  orthographic: { position: [70, 70, 70], minPolar: 0.4, maxPolar: 1.15 },
  perspective: { position: [0, 45, 65], minPolar: 0.15, maxPolar: 1.45 },
};

export function CameraRig({ viewMode }: { viewMode: ViewMode }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const settings = VIEW_SETTINGS[viewMode];

  return (
    <>
      {viewMode === 'perspective' ? (
        <PerspectiveCamera makeDefault position={settings.position} fov={45} near={1} far={500} />
      ) : (
        <OrthographicCamera
          makeDefault
          position={settings.position}
          left={-VIEW_HALF_WIDTH}
          right={VIEW_HALF_WIDTH}
          top={VIEW_HALF_HEIGHT}
          bottom={-VIEW_HALF_HEIGHT}
          zoom={1}
          near={0.1}
          far={500}
        />
      )}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        key={viewMode}
        target={[0, 0, 0]}
        minPolarAngle={settings.minPolar}
        maxPolarAngle={settings.maxPolar}
        minDistance={15}
        maxDistance={160}
        minZoom={0.4}
        maxZoom={4}
        enableDamping
        dampingFactor={0.12}
      />
    </>
  );
}
