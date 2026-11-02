import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FIELD_LENGTH, HALF_WIDTH } from './dimensions';
import { makeAdTexture } from './ads';

/**
 * 街球风外景：铁丝网围栏 + 远端涂鸦墙 + 城市天际线 + 灯杆 + 路障。
 *
 * 约束不变：相机走廊 z ∈ [-35, -14]、y ∈ [6.5, 21]。
 * 所有实体只放在远端（z > 58）和两侧（|x| > 16.8），近端保持空旷，任何缩放都不挡视线。
 */

/** 铁丝网纹理（菱形网格，带透明通道） */
function makeFenceTexture(): THREE.Texture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(200, 210, 225, 0.9)';
  ctx.lineWidth = 3;
  const step = 32;
  for (let i = -S; i < S * 2; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + S, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, S);
    ctx.lineTo(i + S, 0);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildFence(): THREE.Group {
  const group = new THREE.Group();
  const fenceTex = makeFenceTexture();
  const fenceMat = new THREE.MeshStandardMaterial({
    map: fenceTex,
    transparent: true,
    alphaTest: 0.25,
    side: THREE.DoubleSide,
    metalness: 0.35,
    roughness: 0.6,
    color: 0xc9d2e0,
  });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.6, roughness: 0.5 });

  const H = 3.4;
  const rail = new THREE.MeshStandardMaterial({ color: 0x4a505c, metalness: 0.6, roughness: 0.5 });

  // 两侧围栏（沿 z）
  for (const side of [-1, 1]) {
    const x = side * (HALF_WIDTH + 3.6);
    // 围栏一直延伸到相机后方（最大 zoom out 时也看不到断口）
    const len = 104;
    const zc = 15;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(len, H), fenceMat.clone());
    const mat = plane.material as THREE.MeshStandardMaterial;
    if (mat.map) {
      mat.map = mat.map.clone();
      mat.map.needsUpdate = true;
      mat.map.repeat.set(len / 3.2, H / 3.2);
    }
    plane.rotation.y = Math.PI / 2;
    plane.position.set(x, H / 2, zc);
    group.add(plane);

    // 顶部横杆 + 立柱
    for (const y of [H - 0.06, 0.9]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 6), rail);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(x, y, zc);
      group.add(bar);
    }
    for (let z = zc - len / 2; z <= zc + len / 2; z += 6) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, H + 0.3, 6), postMat);
      post.position.set(x, (H + 0.3) / 2, z);
      group.add(post);
    }
  }

  // （远端不设围栏：让涂鸦墙和城市天际线完整露出来）

  return group;
}

/** 城市天际线：暗色楼体 + 暖色窗光 */
function buildCity(): THREE.Group {
  const group = new THREE.Group();

  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, S, S);
  const rnd = (() => {
    let a = 1234567;
    return () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
  })();
  for (let y = 5; y < S - 5; y += 13) {
    for (let x = 5; x < S - 5; x += 11) {
      if (rnd() < 0.5) {
        ctx.fillStyle = rnd() < 0.5 ? '#ffcf8a' : '#ffb066';
        ctx.globalAlpha = 0.4 + rnd() * 0.4;
        ctx.fillRect(x, y, 4, 6);
      }
    }
  }
  ctx.globalAlpha = 1;
  const winTex = new THREE.CanvasTexture(canvas);
  winTex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshStandardMaterial({
    color: 0x120e1e,
    emissive: 0xffb066,
    emissiveMap: winTex,
    emissiveIntensity: 0.55,
    roughness: 0.95,
  });

  const geoCache: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 30; i++) {
    const w = 8 + Math.random() * 12;
    const h = 10 + Math.random() * 26;
    const d = 8 + Math.random() * 10;
    const x = (Math.random() - 0.5) * 340;
    const z = 115 + Math.random() * 110;
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(x, h / 2, z);
    geoCache.push(geo);
  }
  // 两侧的近处楼体
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const w = 8 + Math.random() * 10;
    const h = 8 + Math.random() * 14;
    const d = 8 + Math.random() * 10;
    const x = side * (95 + Math.random() * 60);
    const z = 5 + Math.random() * 90;
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(x, h / 2, z);
    geoCache.push(geo);
  }

  // 合并成 1 个 mesh（顶点数很少）
  const merged = mergeBoxes(geoCache);
  if (merged) {
    const mesh = new THREE.Mesh(merged, mat);
    group.add(mesh);
  }
  return group;
}

/** 简易合并（避免引入额外依赖）：把顶点/法线/UV 拼起来 */
function mergeBoxes(geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geos.length === 0) return null;
  const pos: number[] = [];
  const norm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let offset = 0;
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    const p = ng.attributes.position.array as Float32Array;
    const n = ng.attributes.normal.array as Float32Array;
    const u = ng.attributes.uv.array as Float32Array;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    for (let i = 0; i < n.length; i++) norm.push(n[i]);
    for (let i = 0; i < u.length; i++) uv.push(u[i]);
    const count = p.length / 3;
    for (let i = 0; i < count; i++) idx.push(offset + i);
    offset += count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  merged.setIndex(idx);
  return merged;
}

/** 远端涂鸦墙 */
function buildWall(): THREE.Group {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3442, roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(46, 5, 0.7), wallMat);
  wall.position.set(0, 2.5, 63);
  group.add(wall);

  // 涂鸦贴图
  const W = 1024;
  const H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3a3442';
  ctx.fillRect(0, 0, W, H);

  // 喷漆色块
  const rnd = (() => {
    let a = 99;
    return () => {
      a = (a * 1103515245 + 12345) >>> 0;
      return a / 4294967296;
    };
  })();
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = 0.12 + rnd() * 0.2;
    ctx.fillStyle = ['#ff4f7b', '#ffb03a', '#3ad1c8', '#8a5cff'][Math.floor(rnd() * 4)];
    ctx.beginPath();
    ctx.ellipse(rnd() * W, rnd() * H, 20 + rnd() * 60, 10 + rnd() * 30, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 74px system-ui, "Arial Black", sans-serif';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#120f18';
  ctx.strokeText('FLAG BOWL', W / 2, H / 2);
  const grad = ctx.createLinearGradient(W * 0.25, 0, W * 0.75, H);
  grad.addColorStop(0, '#ffd166');
  grad.addColorStop(0.5, '#ff7b54');
  grad.addColorStop(1, '#ff4f7b');
  ctx.fillStyle = grad;
  ctx.fillText('FLAG BOWL', W / 2, H / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mural = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 4.2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, emissive: 0x1a0f18, emissiveIntensity: 0.6 }),
  );
  mural.position.set(0, 2.7, 62.6);
  mural.rotation.y = Math.PI;
  group.add(mural);
  return group;
}

/** 灯杆 + 暖色灯头 + 光晕 */
function buildLightPoles(): THREE.Group {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e2a36, metalness: 0.55, roughness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0x201a1a,
    emissive: 0xffc98a,
    emissiveIntensity: 2.2,
    roughness: 0.4,
  });

  // 光晕贴图
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255, 214, 160, 0.95)');
  g.addColorStop(0.35, 'rgba(255, 170, 110, 0.35)');
  g.addColorStop(1, 'rgba(255, 150, 90, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const glowTex = new THREE.CanvasTexture(canvas);
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffd0a0,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.75,
  });

  const H = 19;
  for (const [x, z] of [
    [-19.5, -8],
    [19.5, -8],
    [-19.5, 59],
    [19.5, 59],
  ]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, H, 8), poleMat);
    pole.position.set(x, H / 2, z);
    group.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.18), poleMat);
    arm.position.set(x + (x < 0 ? 1.4 : -1.4), H - 0.2, z);
    group.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 0.9), lampMat);
    head.position.set(x + (x < 0 ? 2.6 : -2.6), H - 0.45, z);
    group.add(head);
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(7);
    glow.position.copy(head.position);
    group.add(glow);
  }
  return group;
}

/** 街边道具：路障（部分随机倒伏）+ 长椅 */
function buildProps(): THREE.Group {
  const group = new THREE.Group();
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a2a, roughness: 0.7 });
  const spots: Array<[number, number]> = [
    [-15.2, -6],
    [15.2, -6],
    [-15.2, 10],
    [15.2, 36],
    [-15.2, 44],
    [15.2, 20],
    [-15.4, 30],
  ];
  for (const [x, z] of spots) {
    const fallen = Math.random() < 0.38;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.52, 12), coneMat);
    cone.userData.cone = true;
    if (fallen) {
      // 倒下：绕 Z 轴放平 + 随机朝向，位置略微散开
      cone.rotation.z = (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2);
      cone.rotation.y = Math.random() * Math.PI * 2;
      cone.position.set(x + (Math.random() - 0.5) * 1.4, 0.2, z + (Math.random() - 0.5) * 1.4);
    } else {
      cone.position.set(x, 0.26, z);
      cone.rotation.y = Math.random() * Math.PI;
    }
    group.add(cone);
  }

  // 远端长椅
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(6, 0.18, 0.9), benchMat);
    bench.position.set(side * 22, 0.55, 62);
    group.add(bench);
    for (const dx of [-2.4, 2.4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.8), benchMat);
      leg.position.set(side * 22 + dx, 0.28, 62);
      group.add(leg);
    }
  }
  return group;
}

/** 远山剪影（三层，越远越淡） */
function buildMountains(): THREE.Group {
  const group = new THREE.Group();
  const W = 1024;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const ridge = (base: number, amp: number, color: string, seed: number) => {
    let a = seed;
    const rnd = () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
    ctx.beginPath();
    ctx.moveTo(0, H);
    const pts: number[] = [];
    const n = 26;
    for (let i = 0; i <= n; i++) pts.push(base + Math.sin(i * 0.7 + seed) * amp * 0.5 + rnd() * amp * 0.7);
    ctx.lineTo(0, H - pts[0] * H);
    for (let i = 1; i <= n; i++) {
      const x = (i / n) * W;
      const y = H - pts[i] * H;
      const px = ((i - 1) / n) * W;
      const py = H - pts[i - 1] * H;
      ctx.quadraticCurveTo((px + x) / 2, Math.min(py, y) - 12, x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  ridge(0.5, 0.16, '#6b3d63', 7);
  ridge(0.4, 0.2, '#4c2a4f', 13);
  ridge(0.28, 0.24, '#2e1b37', 29);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 150),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide }),
  );
  mesh.position.set(0, 74, 300);
  group.add(mesh);
  return group;
}

/** 街球场围栏上的广告海报（≤5 张，随机位置） */
function buildStreetAds(): THREE.Group {
  const group = new THREE.Group();
  const COUNT = 5;
  for (let i = 0; i < COUNT; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const z = -6 + Math.random() * 56;
    const tex = makeAdTexture(i % 3);
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 2.1),
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.8,
        emissive: 0x120b0f,
        emissiveIntensity: 0.35,
      }),
    );
    poster.position.set(side * (HALF_WIDTH + 3.48), 2.0, z);
    poster.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(poster);
  }
  return group;
}

/** 街球场外景总装 */
export function buildStadium(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'street-stadium';
  group.add(buildMountains());
  group.add(buildFence());
  group.add(buildStreetAds());
  group.add(buildCity());
  group.add(buildWall());
  group.add(buildLightPoles());
  group.add(buildProps());
  return group;
}

const loader = new GLTFLoader();

/**
 * 外部体育场模型（可选）：按包围盒缩放到指定宽度，底面贴地，球场中心对齐。
 * 仅当模型本身是「开放式」时使用；封闭式场馆会挡住相机，请用 buildStadium()。
 */
export async function loadStadium(scene: THREE.Scene, url: string, targetWidth = 150): Promise<THREE.Group | null> {
  try {
    const gltf = await loader.loadAsync(url);
    const obj = gltf.scene;
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    obj.scale.setScalar(targetWidth / maxDim);
    const scaled = new THREE.Box3().setFromObject(obj);
    const center = scaled.getCenter(new THREE.Vector3());
    obj.position.set(-center.x, -scaled.min.y, FIELD_LENGTH / 2 - center.z);
    obj.traverse((n) => {
      if ((n as THREE.Mesh).isMesh) {
        n.castShadow = false;
        n.receiveShadow = false;
      }
    });
    scene.add(obj);
    return obj;
  } catch (e) {
    console.warn('[stadium] 体育场模型加载失败，已跳过：', e);
    return null;
  }
}

/**
 * 头盔模型：缩放至头围约 0.36yd、朝向 +z（球员正面），返回可 clone 的模板。
 * 失败返回 null，调用方保留几何头盔。
 */
export async function loadHelmet(url = './models/helmet.glb'): Promise<THREE.Object3D | null> {
  try {
    const gltf = await loader.loadAsync(url);
    const obj = gltf.scene;
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 0.36 / maxDim;
    obj.scale.setScalar(scale);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center.clone().multiplyScalar(scale));
    // 源模型面罩在 +x，旋转到 +z 与球员朝向一致
    obj.rotation.y = -Math.PI / 2;
    return obj;
  } catch (e) {
    console.warn('[helmet] 头盔模型加载失败，使用几何头盔：', e);
    return null;
  }
}

/** 加载后的球员模型：场景根节点 + 自带动画（可为空） */
export interface PlayerModelAsset {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

/** 只含骨架与动作的 glb：把动画复用到任何同骨架的模型上 */
export async function loadAnimationClips(url: string): Promise<THREE.AnimationClip[]> {
  try {
    const gltf = await loader.loadAsync(url);
    return gltf.animations ?? [];
  } catch (e) {
    console.warn('[anim] 动画文件加载失败：', e);
    return [];
  }
}

/**
 * 全身球员模型（Tripo / Mixamo 导出的 glb）：归一化到 1.92yd 高、脚底贴地、正面朝 +z。
 * 返回模板与动画；骨骼模型请用 cloneSkeleton() 复制。
 */
export async function loadPlayerModel(
  url: string,
  targetHeight = 1.92,
  facing: 'z' | '-z' | 'x' | '-x' = 'z',
): Promise<PlayerModelAsset | null> {
  try {
    const gltf = await loader.loadAsync(url);
    const obj = gltf.scene;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const scale = targetHeight / (size.y || 1);
    obj.scale.setScalar(scale);
    const scaled = new THREE.Box3().setFromObject(obj);
    const center = scaled.getCenter(new THREE.Vector3());
    // 脚底再往下 2cm：模拟钉鞋踩进草地，避免「悬浮」
    obj.position.set(-center.x, -scaled.min.y - 0.02, -center.z);
    const yaw = { z: 0, '-z': Math.PI, x: Math.PI / 2, '-x': -Math.PI / 2 }[facing];
    obj.rotation.y = yaw;
    obj.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
      }
    });
    return { scene: obj, animations: gltf.animations ?? [] };
  } catch (e) {
    console.warn('[player] 球员模型加载失败，使用几何球员：', e);
    return null;
  }
}
