import * as THREE from 'three';

/**
 * 以四分卫为焦点的第三人称视角。
 * - 焦点固定在 QB 胸口，缩放时 QB 始终位于画面中央附近，脚部不会被裁掉
 * - zoom -0.5..1：负值 = 拉近（相机更低更近），1 = 拉远
 * - yaw：绕 QB 左右平移视角
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
export const MAX_YAW = 0.3;

/** 镜头看的点：QB 身前 4 码的胸口高度（既框住 QB，又能看到前方球场） */
export const LOOK_TARGET = new THREE.Vector3(0, 1.2, 1);

/** 相机位置：以 QB 为圆心 */
export function cameraPose(zoom: number): THREE.Vector3 {
  const t = Math.min(1, Math.max(MIN_ZOOM, zoom)) + 0.5; // 0..1.5
  const dist = 7 + t * 14; // 7 ~ 28
  const height = 2.2 + t * 6.0; // 2.2 ~ 8.2
  return new THREE.Vector3(0, height, -3 - dist);
}

export function createCamera(): CameraRig {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);

  const rig: CameraRig = {
    camera,
    zoom: 0,
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
    const pose = cameraPose(rig.zoom);
    const offset = pose.clone().sub(LOOK_TARGET);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rig.yaw);
    camera.position.copy(LOOK_TARGET).add(offset);
    camera.lookAt(LOOK_TARGET);
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
      rig.setZoom(rig.zoom + (e.deltaY > 0 ? 0.06 : -0.06));
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
