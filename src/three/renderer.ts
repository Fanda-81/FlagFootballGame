import * as THREE from 'three';

export interface RendererHandle {
  renderer: THREE.WebGLRenderer;
  /** 每帧回调：dt（秒）、累计时间 t */
  onFrame: ((dt: number, t: number) => void) | null;
  start(): void;
  resize(): void;
  /** 画质：high = 设备像素比（≤1.75），low = 1x */
  setQuality(q: 'high' | 'low'): void;
  /** 当前生效画质（可能被自动降档） */
  readonly quality: 'high' | 'low';
  /** 自动降档时回调，便于持久化 */
  onQualityChange: ((q: 'high' | 'low') => void) | null;
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): RendererHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // 更接近真实转播的色调映射
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  let quality: 'high' | 'low' = 'high';

  const resize = () => {
    const w = Math.max(1, canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, canvas.clientHeight || window.innerHeight);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    // 竖屏/窄屏时水平视野会被裁掉：适当加大纵向 FOV，保证 WR 与两侧边线都在画面里
    camera.fov = aspect < 1 ? Math.min(74, 50 / Math.max(aspect, 0.68)) : 50;
    camera.updateProjectionMatrix();
  };
  resize();

  // 用 ResizeObserver 覆盖旋转屏幕 / 窗口缩放 / 地址栏收起等布局变化
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  const handle: RendererHandle = {
    renderer,
    onFrame: null,
    onQualityChange: null,
    get quality() {
      return quality;
    },
    resize,
    setQuality(q) {
      quality = q;
      renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio, 1.75) : 1);
      resize();
    },
    start() {
      let last = performance.now();
      let frames = 0;
      let elapsed = 0;
      let degraded = false;

      const loop = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;

        // 后台标签页不渲染，回来时重置计时，避免 dt 突刺
        if (document.hidden) {
          requestAnimationFrame(loop);
          return;
        }

        handle.onFrame?.(dt, now / 1000);
        renderer.render(scene, camera);

        // 前 120 帧做一次性能采样：持续掉帧则自动降档（只降一次，不来回跳）
        if (frames < 120) {
          frames += 1;
          elapsed += dt;
          if (frames === 120 && !degraded && elapsed / 120 > 1 / 42) {
            degraded = true;
            if (quality === 'high') {
              handle.setQuality('low');
              handle.onQualityChange?.('low');
            }
          }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
  };
  return handle;
}
