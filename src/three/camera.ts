import * as THREE from 'three';
import { FIELD_MID_Z } from './dimensions';

/**
 * Madden 式纵向视角 + 缩放 + 双指横移视角。
 * zoom -0.5..1：0 = 默认，负值 = 光学放大（收窄 FOV），1 = 最远。
 * yaw：左右平移视角（弧度，约 ±16°）。
 *
 * 相机走廊：z ∈ [-35, -14]、y ∈ [6.5, 21]；外景必须避开这条走廊。
 */
export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  zoom: number;
  yaw: number;
  setZoom(z: number): void;
  setYaw(y: number): void;
}

export const MIN_ZOOM = -0.5;
export const MAX_ZOOM = 1;
export const MAX_YAW = 0.28;

/** 相机在各缩放档位的位置（供外景避让 / 自动化校验使用） */
export function cameraPose(zoom: number): THREE.Vector3 {
  const z = Math.min(1, Math.max(0, zoom));
  const dist = 14 + z * 21; // 14 ~ 35
  const height = 6.5 + z * 14.5; // 6.5 ~ 21
  return new THREE.Vector3(0, height, -dist);
}

export function createCamera(): CameraRig {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
  const lookTarget = new THREE.Vector3(0, 1.2, FIELD_MID_Z);

  const rig: CameraRig = {
    camera,
    zoom: 0.4,
    yaw: 0,
    setZoom(z: number) {
      rig.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
      apply();
    },
    setYaw(y: number) {
      rig.yaw = Math.min(MAX_YAW, Math.max(-MAX_YAW, y));
      apply();
    },
  };

  function apply(): void {
    // 负 zoom 用收窄 FOV 实现「放大倍数」，不移动相机，避免球员出画
    const fov = rig.zoom < 0 ? 50 + rig.zoom * 26 : 50;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    const pose = cameraPose(Math.max(0, rig.zoom));
    const offset = pose.clone().sub(lookTarget);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rig.yaw);
    camera.position.copy(lookTarget).add(offset);
    camera.lookAt(lookTarget);
  }
  apply();
  return rig;
}

/**
 * 滚轮缩放 + 双指：明显捏合 → 缩放；两指同向横移 → 左右平移视角。
 */
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
  let midBase = 0;
  let yawBase = rig.yaw;
  let mode: 'none' | 'zoom' | 'pan' = 'none';

  const mids = () => {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return { dist: 0, mid: 0 };
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: (a.x + b.x) / 2 };
  };

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const m = mids();
      pinchBase = m.dist;
      midBase = m.mid;
      zoomBase = rig.zoom;
      yawBase = rig.yaw;
      mode = 'none';
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size !== 2) return;

    const m = mids();
    if (!m.dist) return;

    // 先判定手势类型，一旦确定就锁定，避免边缩放边漂移
    if (mode === 'none') {
      const dDist = Math.abs(m.dist - pinchBase);
      const dMid = Math.abs(m.mid - midBase);
      if (dDist > 14 && dDist > dMid) mode = 'zoom';
      else if (dMid > 12 && dMid > dDist) mode = 'pan';
    }

    if (mode === 'zoom' && pinchBase > 0) {
      rig.setZoom(zoomBase + (1 - m.dist / pinchBase) * 0.9);
    } else if (mode === 'pan') {
      rig.setYaw(yawBase - (m.mid - midBase) * 0.0032);
    }
  });

  const end = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinchBase = 0;
    mode = 'none';
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
