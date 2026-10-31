import * as THREE from 'three';

export interface RendererHandle {
  renderer: THREE.WebGLRenderer;
  /** 每帧回调：dt（秒）、累计时间 t */
  onFrame: ((dt: number, t: number) => void) | null;
  start(): void;
  resize(): void;
  /** 画质：high = 设备像素比（≤2），low = 1x */
  setQuality(q: 'high' | 'low'): void;
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): RendererHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const handle: RendererHandle = {
    renderer,
    onFrame: null,
    resize,
    setQuality(q) {
      renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio, 2) : 1);
      resize();
    },
    start() {
      let last = performance.now();
      const loop = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        handle.onFrame?.(dt, now / 1000);
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
  };
  return handle;
}
