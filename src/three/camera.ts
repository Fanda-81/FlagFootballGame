import * as THREE from 'three';

/** Madden 式纵向视角：QB 身后上方，看向纵深 */
export function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  camera.position.set(0, 9, -13);
  camera.lookAt(0, 1.5, 28);
  return camera;
}
