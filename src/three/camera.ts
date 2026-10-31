import * as THREE from 'three';

/**
 * Madden 式纵向视角 + 缩放控制。
 * zoom 0..1：0 = 近景低角（QB 身后），1 = 远景高角（俯瞰全场）。
 */
export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  zoom: number;
  setZoom(z: number): void;
}

export function createCamera(): CameraRig {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
  const lookTarget = new THREE.Vector3(0, 1, 26);

  const rig: CameraRig = {
    camera,
    zoom: 0.32, // 默认：越过看台顶部的俯视
    setZoom(z: number) {
      rig.zoom = Math.min(1, Math.max(0, z));
      apply();
    },
  };

  function apply(): void {
    const dist = 10 + rig.zoom * 24; // 10 ~ 34
    const height = 5.5 + rig.zoom * 16; // 5.5 ~ 21.5（越过看台）
    camera.position.set(0, height, -dist);
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
