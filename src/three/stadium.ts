import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FIELD_LENGTH, HALF_WIDTH } from './dimensions';

/**
 * 球场外景与外部模型加载。
 *
 * 设计约束（很重要）：
 *   相机在 z ∈ [-34, -10]、y ∈ [5.5, 21.5] 的走廊里，沿 +z 看向球场。
 *   任何落在「球场 + 相机走廊」里的实体都会挡住球员/球场。
 *   因此看台只放在 z > 57.5（远端）与 |x| > 16.35（两侧），近端完全留空；
 *   相机最低点 y=5.5 也不会穿进近端任何结构。
 */

const ROWS = 12;
const RISE = 1.25;
const RUN = 2.1;
const SIDE_START_X = HALF_WIDTH + 3; // 16.35：紧贴边线外侧
const STAND_Z0 = -12;
const STAND_Z1 = 56;
const FAR_Z0 = 57.5;
const FAR_HALF_W = 42;
const BACK_WALL_H = 19;
const CROWD_COLORS = [0x9e3a3a, 0x3a5f9e, 0xb0a23c, 0x4a8f52, 0xb06a2e, 0x7a4f96, 0x3f8a8a, 0xc9d2df];

const STAND_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.92,
  metalness: 0.02,
});

function pushBox(
  list: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  shade: THREE.Color,
): void {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  list.push(geo);
}

/** 阶梯看台几何 + 人群 */
function buildStands(): { group: THREE.Group } {
  const group = new THREE.Group();
  const solids: THREE.BufferGeometry[] = [];
  const crowdSpots: Array<{ x: number; y: number; z: number }> = [];

  const shadeA = new THREE.Color(0x2c3648);
  const shadeB = new THREE.Color(0x35415a);

  // 两侧看台
  const sideLen = STAND_Z1 - STAND_Z0;
  const sideCenterZ = (STAND_Z0 + STAND_Z1) / 2;
  for (const side of [-1, 1]) {
    for (let row = 0; row < ROWS; row++) {
      const x = side * (SIDE_START_X + row * RUN);
      const y = 0.5 + row * RISE;
      pushBox(solids, RUN + 0.1, RISE, sideLen, x, y, sideCenterZ, row % 2 ? shadeA : shadeB);
      const seats = 38;
      for (let s = 0; s < seats; s++) {
        crowdSpots.push({
          x: x + (Math.random() - 0.5) * 1.2,
          y: y + RISE / 2,
          z: STAND_Z0 + 2 + (s / seats) * (sideLen - 4) + (Math.random() - 0.5) * 0.9,
        });
      }
    }
  }

  // 远端看台
  for (let row = 0; row < ROWS; row++) {
    const z = FAR_Z0 + row * RUN;
    const y = 0.5 + row * RISE;
    pushBox(solids, FAR_HALF_W * 2, RISE, RUN + 0.1, 0, y, z, row % 2 ? shadeA : shadeB);
    const seats = 64;
    for (let s = 0; s < seats; s++) {
      crowdSpots.push({
        x: -FAR_HALF_W + 2 + (s / seats) * (FAR_HALF_W * 2 - 4) + (Math.random() - 0.5) * 0.9,
        y: y + RISE / 2,
        z: z + (Math.random() - 0.5) * 1.1,
      });
    }
  }

  // 外围挡墙：把看台外的天空/虚空收住，形成碗状
  const wallShade = new THREE.Color(0x1a2233);
  const backX = SIDE_START_X + ROWS * RUN + 0.8;
  for (const side of [-1, 1]) {
    pushBox(solids, 1.2, BACK_WALL_H, STAND_Z1 - STAND_Z0 + 34, side * backX, BACK_WALL_H / 2, 30, wallShade);
  }
  pushBox(solids, backX * 2 + 1.2, BACK_WALL_H, 1.2, 0, BACK_WALL_H / 2, FAR_Z0 + ROWS * RUN + 3, wallShade);

  const merged = mergeGeometries(solids, false);
  if (merged) {
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, STAND_MAT);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }

  // 人群：单 InstancedMesh
  const crowdGeo = new THREE.BoxGeometry(0.42, 0.72, 0.36);
  crowdGeo.translate(0, 0.36, 0);
  const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, crowdSpots.length);
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  crowdSpots.forEach((spot, i) => {
    m.makeRotationY((Math.random() - 0.5) * 0.5);
    m.setPosition(spot.x, spot.y, spot.z);
    crowd.setMatrixAt(i, m);
    color.setHex(CROWD_COLORS[Math.floor(Math.random() * CROWD_COLORS.length)]);
    crowd.setColorAt(i, color);
  });
  crowd.instanceMatrix.needsUpdate = true;
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  group.add(crowd);

  return { group };
}

/** 远端记分牌：Canvas 贴图 + 灯柱 */
function buildScoreboard(): THREE.Group {
  const group = new THREE.Group();

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#050a14';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#2f7fe0';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 240);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb300';
  ctx.font = '900 52px system-ui, "Arial Black", sans-serif';
  ctx.fillText('FLAG BOWL', 256, 78);
  ctx.fillStyle = '#e8eefc';
  ctx.font = '800 64px system-ui, "Arial Black", sans-serif';
  ctx.fillText('0  :  0', 256, 156);
  ctx.fillStyle = '#7fa6dd';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.fillText('Q1   12:00', 256, 212);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 12),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  panel.position.set(0, 21, FAR_Z0 + ROWS * RUN + 2.4);
  panel.rotation.y = Math.PI;
  group.add(panel);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(25.2, 13.2, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x121a29, roughness: 0.8 }),
  );
  frame.position.set(0, 21, FAR_Z0 + ROWS * RUN + 3);
  group.add(frame);

  // 灯柱（远端两角）
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a3446, roughness: 0.7, metalness: 0.5 });
  for (const side of [-1, 1]) {
    const x = side * (FAR_HALF_W - 2);
    const z = FAR_Z0 + ROWS * RUN + 4;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 26, 8), poleMat);
    pole.position.set(x, 13, z);
    group.add(pole);
    // 灯架：深色支架 + 低亮面板，避免夜空里出现两块刺眼的白块
    const rig = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 0.6), poleMat);
    rig.position.set(x, 26, z);
    group.add(rig);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x9aa6b8, toneMapped: false });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.6, 0.25), lampMat);
    lamp.position.set(x, 26.8, z - 0.4);
    lamp.rotation.x = 0.28;
    group.add(lamp);
  }

  return group;
}

/** 程序化开放式看台（默认球场外景） */
export function buildStadium(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'procedural-stadium';
  group.add(buildStands().group);
  group.add(buildScoreboard());
  return group;
}

const loader = new GLTFLoader();

/**
 * 外部体育场模型（可选）：按包围盒缩放到指定宽度，底面贴地，球场中心对齐。
 * 仅在模型本身是「开放式碗形」时使用；封闭式场馆会挡住相机，请改用 buildStadium()。
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
 * 头盔模型：缩放至头围约 0.62yd、朝向 +z（球员正面），返回可 clone 的模板。
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

/**
 * 全身球员模型（Tripo / Mixamo 导出的 glb）：归一化到 1.92yd 高、脚底贴地、正面朝 +z。
 * 返回模板；骨骼模型请用 cloneSkinned() 复制。
 */
export async function loadPlayerModel(
  url: string,
  targetHeight = 1.92,
  facing: 'z' | '-z' | 'x' | '-x' = 'z',
): Promise<THREE.Object3D | null> {
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
    obj.position.set(-center.x, -scaled.min.y, -center.z);
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
    return obj;
  } catch (e) {
    console.warn('[player] 球员模型加载失败，使用几何球员：', e);
    return null;
  }
}
