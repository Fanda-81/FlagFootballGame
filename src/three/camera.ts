import * as THREE from 'three';
import { FIELD_MID_Z } from './dimensions';

/**
 * Madden 式纵向视角 + 缩放控制。
 * zoom 0..1：0 = 近景低角（QB 身后），1 = 远景高角（俯瞰全场）。
 *
 * 相机走廊：z ∈ [-34, -10]、y ∈ [5.5, 21.5]。
 * 球场外景必须避开这条走廊——看台只允许出现在远端（z > 57）与两侧（|x| > 16），
 * 近端保持空旷，任何缩放下都不会被挡住。
 */
export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  zoom: number;
  setZoom(z: number): void;
}

/** 相机在各缩放档位的位置（供外景避让 / 自动化校验使用） */
export function cameraPose(zoom: number): THREE.Vector3 {
  const z = Math.min(1, Math.max(0, zoom));
  const dist = 14 + z * 21; // 14 ~ 35
  const height = 6.5 + z * 14.5; // 6.5 ~ 21
  return new THREE.Vector3(0, height, -dist);
}

export function createCamera(): CameraRig {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 800);
  const lookTarget = new THREE.Vector3(0, 1.2, FIELD_MID_Z);

  const rig: CameraRig = {
    camera,
    zoom: 0.4,
    setZoom(z: number) {
      rig.zoom = Math.min(1, Math.max(0, z));
      apply();
    },
  };

  function apply(): void {
    camera.position.copy(cameraPose(rig.zoom));
    camera.lookAt(lookTarget);
  }
  apply();
  return rig;
}

/** 滚轮 + 双指捏合缩放 */
export function attachZoom(canvas: HTMLElement, rig: CameraRig): void {
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      rig.setZoom(rig.zoom + (e.deltaY > 0 ? 0.07 : -0.07));
    },
    { passive: false },
  );

  const pointers = new Map<number, { x: number; y: number }>();
  let pinchBase = 0;
  let zoomBase = rig.zoom;

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      pinchBase = pinchDist();
      zoomBase = rig.zoom;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const d = pinchDist();
      if (pinchBase > 0) {
        const ratio = d / pinchBase;
        rig.setZoom(zoomBase + (1 - ratio) * 0.9);
      }
    }
  });
  const end = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinchBase = 0;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  function pinchDist(): number {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
