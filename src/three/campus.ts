import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ENDZONE_DEPTH, FIELD_LENGTH, HALF_WIDTH } from './dimensions';
import { makeAdTexture } from './ads';

/**
 * 大学校园球场（白天）：广告牌围场、看台、红砖校舍、树、球门。
 * 相机走廊仍然留空：看台/建筑都在 |x| > 18 或 z > 60。
 */

const BOARD_X = HALF_WIDTH + 2.6; // 15.95
// 近端不做广告牌：相机在近端后方，会看到板子背面挡住画面
const BOARD_Z0 = -28;
const BOARD_Z1 = 58;
const BOARD_H = 1.15;

function pushBox(
  list: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): void {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  list.push(g);
}

/** 广告牌围场：一圈板子 + 三种广告画面 */
function buildBoards(): THREE.Group {
  const group = new THREE.Group();
  const backing: THREE.BufferGeometry[] = [];
  const adGeos: THREE.BufferGeometry[][] = [[], [], []];

  const addPanel = (x: number, y: number, z: number, rotY: number, i: number): void => {
    const geo = new THREE.PlaneGeometry(4, BOARD_H - 0.12);
    const m = new THREE.Matrix4().makeRotationY(rotY);
    m.setPosition(x, y, z);
    geo.applyMatrix4(m);
    adGeos[i % 3].push(geo);
  };

  // 两侧
  for (const side of [-1, 1]) {
    const x = side * BOARD_X;
    pushBox(backing, 0.22, BOARD_H, BOARD_Z1 - BOARD_Z0, x, BOARD_H / 2, (BOARD_Z0 + BOARD_Z1) / 2);
    for (let z = -4; z < BOARD_Z1; z += 4.2) {
      addPanel(x - side * 0.13, BOARD_H / 2 + 0.05, z, side > 0 ? -Math.PI / 2 : Math.PI / 2, Math.round((z + 4) / 4.2));
    }
  }
  // 只有远端有横向广告牌（近端留给相机）
  {
    const z = BOARD_Z1;
    pushBox(backing, BOARD_X * 2, BOARD_H, 0.22, 0, BOARD_H / 2, z);
    for (let x = -BOARD_X + 2; x < BOARD_X; x += 4.2) {
      addPanel(x, BOARD_H / 2 + 0.05, z - 0.13, Math.PI, Math.round((x + BOARD_X) / 4.2));
    }
  }

  const merged = mergeGeometries(backing, false);
  if (merged) {
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.85 }),
    );
    group.add(mesh);
  }

  adGeos.forEach((list, i) => {
    if (!list.length) return;
    const geo = mergeGeometries(list, false);
    if (!geo) return;
    const mat = new THREE.MeshStandardMaterial({
      map: makeAdTexture(i),
      roughness: 0.75,
      emissive: 0x111111,
      emissiveIntensity: 0.15,
    });
    group.add(new THREE.Mesh(geo, mat));
  });
  return group;
}

/** 看台 + 室内观众 */
function buildGrandstand(): THREE.Group {
  const group = new THREE.Group();
  const concrete: THREE.BufferGeometry[] = [];
  const rows = 6;
  const rise = 0.95;
  const run = 1.7;
  const len = 66;

  const seatShade = new THREE.MeshStandardMaterial({ color: 0x6c7686, roughness: 0.9 });
  const crowdSpots: Array<{ x: number; y: number; z: number }> = [];

  for (const side of [-1, 1]) {
    for (let r = 0; r < rows; r++) {
      const x = side * (24 + r * run);
      const y = 0.6 + r * rise;
      const g = new THREE.BoxGeometry(run + 0.08, rise, len);
      g.translate(x, y, 25);
      concrete.push(g);
      for (let s = 0; s < 24; s++) {
        crowdSpots.push({
          x: x + (Math.random() - 0.5) * 0.9,
          y: y + rise / 2,
          z: 25 - len / 2 + 3 + (s / 24) * (len - 6) + (Math.random() - 0.5) * 0.8,
        });
      }
    }
  }
  // 远端看台
  for (let r = 0; r < rows; r++) {
    const z = 72 + r * run;
    const y = 0.6 + r * rise;
    const g = new THREE.BoxGeometry(58, rise, run + 0.08);
    g.translate(0, y, z);
    concrete.push(g);
    for (let s = 0; s < 34; s++) {
      crowdSpots.push({
        x: -28 + 2 + (s / 34) * 52 + (Math.random() - 0.5) * 0.8,
        y: y + rise / 2,
        z: z + (Math.random() - 0.5) * 0.9,
      });
    }
  }

  const merged = mergeGeometries(concrete, false);
  if (merged) group.add(new THREE.Mesh(merged, seatShade));

  // 观众方块已移除（改为纯看台）

  // 远端新闻间/看台顶（带支撑柱）
  const press = new THREE.Mesh(
    new THREE.BoxGeometry(60, 3.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x8d8a86, roughness: 0.85 }),
  );
  press.position.set(0, 9.5, 83);
  group.add(press);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(52, 1.6, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x2a3a4a, metalness: 0.6, roughness: 0.2 }),
  );
  glass.position.set(0, 9.6, 79.9);
  group.add(glass);
  const colMat = new THREE.MeshStandardMaterial({ color: 0x6b6f75, roughness: 0.8 });
  for (const x of [-26, -9, 9, 26]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9.5, 0.6), colMat);
    col.position.set(x, 4.75, 79.9);
    group.add(col);
  }

  return group;
}

/** 红砖校舍天际线 */
function buildCampusBuildings(): THREE.Group {
  const group = new THREE.Group();
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8c4a3a';
  ctx.fillRect(0, 0, S, S);
  for (let y = 18; y < S - 10; y += 34) {
    for (let x = 14; x < S - 10; x += 28) {
      ctx.fillStyle = '#2b3440';
      ctx.fillRect(x, y, 14, 20);
      ctx.fillStyle = 'rgba(190, 220, 255, 0.35)';
      ctx.fillRect(x + 2, y + 2, 5, 7);
    }
  }
  const winTex = new THREE.CanvasTexture(canvas);
  winTex.colorSpace = THREE.SRGBColorSpace;
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;

  const brickMat = new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5f3a30, roughness: 0.9 });
  const geos: THREE.BufferGeometry[] = [];
  const roofs: THREE.BufferGeometry[] = [];

  const place = (x: number, z: number, w: number, h: number, d: number): void => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, h / 2, z);
    // 简单的 UV 缩放：每 3 米一个窗格
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 8), uv.getY(i) * (h / 8));
    geos.push(g);
    const r = new THREE.BoxGeometry(w + 1.2, 0.8, d + 1.2);
    r.translate(x, h + 0.4, z);
    roofs.push(r);
  };

  place(0, 104, 16, 40, 14);
  place(-26, 112, 22, 26, 16);
  place(28, 110, 20, 30, 15);
  place(-52, 118, 18, 20, 14);
  place(54, 120, 24, 22, 16);
  place(-80, 124, 20, 16, 14);
  place(82, 126, 22, 18, 14);

  const merged = mergeGeometries(geos, false);
  if (merged) group.add(new THREE.Mesh(merged, brickMat));
  const mergedRoof = mergeGeometries(roofs, false);
  if (mergedRoof) group.add(new THREE.Mesh(mergedRoof, roofMat));

  // 钟楼
  const tower = new THREE.Mesh(new THREE.BoxGeometry(9, 52, 9), brickMat.clone());
  tower.position.set(0, 26, 118);
  group.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(7, 9, 4), roofMat);
  cap.position.set(0, 56.5, 118);
  cap.rotation.y = Math.PI / 4;
  group.add(cap);
  const clock = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 24),
    new THREE.MeshStandardMaterial({ color: 0xf3ead0, roughness: 0.6 }),
  );
  clock.position.set(0, 40, 113.4);
  group.add(clock);

  return group;
}

/** 校园树（实例化） */
function buildTrees(): THREE.Group {
  const group = new THREE.Group();
  const spots: Array<[number, number]> = [];
  // 树只放在远端高楼前的空地（看台后面），不挡球场视线
  for (let i = 0; i < 30; i++) {
    spots.push([-95 + Math.random() * 190, 82 + Math.random() * 16]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 2.4, 6);
  trunkGeo.translate(0, 1.2, 0);
  const trunk = new THREE.InstancedMesh(
    trunkGeo,
    new THREE.MeshStandardMaterial({ color: 0x5a4534, roughness: 1 }),
    spots.length,
  );
  const leafGeo = new THREE.SphereGeometry(1.9, 8, 6);
  const leaf = new THREE.InstancedMesh(
    leafGeo,
    new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1 }),
    spots.length,
  );
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  spots.forEach(([x, z], i) => {
    const scale = 0.85 + Math.random() * 0.5;
    p.set(x, 0, z);
    s.set(scale, scale, scale);
    q.identity();
    m.compose(p, q, s);
    trunk.setMatrixAt(i, m);
    p.set(x, 2.2 * scale + 0.8, z);
    s.set(scale * (0.9 + Math.random() * 0.3), scale * 1.1, scale * (0.9 + Math.random() * 0.3));
    m.compose(p, q, s);
    leaf.setMatrixAt(i, m);
    col.setHSL(0.28 + Math.random() * 0.06, 0.45, 0.32 + Math.random() * 0.1);
    leaf.setColorAt(i, col);
  });
  trunk.instanceMatrix.needsUpdate = true;
  leaf.instanceMatrix.needsUpdate = true;
  if (leaf.instanceColor) leaf.instanceColor.needsUpdate = true;
  group.add(trunk, leaf);
  return group;
}

/** 达阵柱 + 角旗（8 根，缩小到与球员比例相称） */
function buildGoals(): THREE.Group {
  const group = new THREE.Group();
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0xff6a2a, roughness: 0.7 });
  // 两个端区各 4 角：端线 + 得分线
  const zs = [0, FIELD_LENGTH];
  for (const z of zs) {
    for (const x of [-HALF_WIDTH, HALF_WIDTH]) {
      for (const dz of [-ENDZONE_DEPTH, 0]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), pylonMat);
        p.position.set(x, 0.28, z + dz);
        group.add(p);
      }
    }
  }
  return group;
}

/** 对面看台上的大屏幕：绿色荧光数字显示连击/尝试/成功率 */
function buildScreen(): { mesh: THREE.Group; set: (combo: number, attempts: number, rate: string) => void } {
  const W = 1024;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const draw = (combo: number, attempts: number, rate: string): void => {
    ctx.fillStyle = '#03100a';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.25)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#7dffc4';
    ctx.font = 'bold 44px "Courier New", monospace';
    ctx.fillText('FFSIMU  •  LIVE STATS', W / 2, 52);
    ctx.font = 'bold 66px "Courier New", monospace';
    ctx.fillStyle = '#c8ffe4';
    ctx.fillText(`COMBO ${String(combo).padStart(2, '0')}`, W * 0.22, 158);
    ctx.fillText(`ATT ${String(attempts).padStart(2, '0')}`, W * 0.52, 158);
    ctx.fillText(`RATE ${rate}`, W * 0.82, 158);
    ctx.shadowBlur = 0;
    tex.needsUpdate = true;
  };
  draw(0, 0, '--');

  const group = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(43, 11.8, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.8 }),
  );
  frame.position.set(0, 13.4, 79.8);
  group.add(frame);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(41, 10.4),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  screen.position.set(0, 13.4, 79.45);
  screen.rotation.y = Math.PI;
  group.add(screen);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.8 });
  for (const x of [-16, 16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7.5, 0.8), legMat);
    leg.position.set(x, 4.5, 79.8);
    group.add(leg);
  }
  return { mesh: group, set: draw };
}

/** 校园场外景总装 */
export function buildCampusScene(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'campus-stadium';
  group.add(buildBoards());
  group.add(buildGrandstand());
  group.add(buildCampusBuildings());
  group.add(buildTrees());
  group.add(buildGoals());
  const screen = buildScreen();
  group.add(screen.mesh);
  group.userData.setScore = screen.set;
  return group;
}

export { BOARD_X, BOARD_Z0, BOARD_Z1 };
