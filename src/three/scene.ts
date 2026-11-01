import * as THREE from 'three';
import {
  ENDZONE_DEPTH,
  FIELD_LENGTH,
  FIELD_TOTAL_LENGTH,
  FIELD_WIDTH,
  HALF_WIDTH,
} from './dimensions';
import { buildStadium } from './stadium';

export { FIELD_LENGTH, FIELD_WIDTH, ENDZONE_DEPTH, FIELD_TOTAL_LENGTH } from './dimensions';

/** 低多边形球员骨架：躯干/头盔/四肢 + 腰旗，四肢可摆动（跑动动画） */
export interface PlayerRig {
  group: THREE.Group;
  /** 几何体身体（接入真实球员模型后整体隐藏） */
  body: THREE.Group;
  /** 真实球员模型挂点（未接入时为空组） */
  modelHolder: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  /** 头部挂点：几何头/真实头盔模型都挂这里 */
  headAnchor: THREE.Group;
  /** 球衣主色（用于头盔调色） */
  jerseyColor: number;
}

export interface FieldObjects {
  scene: THREE.Scene;
  qb: PlayerRig;
  wr: PlayerRig;
  ball: THREE.Object3D;
  /** 程序化开放式看台（不做遮挡，可整体调显隐） */
  stadium: THREE.Group;
}

/** 确定性随机：保证每次构建的草皮噪点一致 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 整场画在一张 canvas 纹理上（草皮条纹 + 码线 + 码数 + 端区 + 边线 + 开球点），
 * 场地面片仅 1 个 draw call。
 *
 * 坐标映射（与相机从 z 负方向看向正方向一致）：
 *   - 画布顶部 = 球场远端（z=55），画布底部 = 近端（z=-5）
 *   - 画布右侧 = 屏幕右侧 = 世界 -x
 *   因此贴图需要 flipY=false，并把 x 反向映射，文字才能正着读。
 */
function makeFieldTexture(): THREE.CanvasTexture {
  const PX_PER_YD = 40;
  const W = Math.round(FIELD_WIDTH * PX_PER_YD); // 1068
  const H = Math.round(FIELD_TOTAL_LENGTH * PX_PER_YD); // 2400

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // 贴图 u 轴在球场上与屏幕方向相反，整体镜像绘制一次，文字才能正着读
  ctx.translate(W, 0);
  ctx.scale(-1, 1);

  const px = (x: number) => ((x + HALF_WIDTH) / FIELD_WIDTH) * W;
  const pz = (z: number) => (1 - (z + ENDZONE_DEPTH) / FIELD_TOTAL_LENGTH) * H;
  const SY = H / FIELD_TOTAL_LENGTH; // 每码像素（纵向）
  const SX = W / FIELD_WIDTH;

  // ---- 草皮底色 + 每 5 码明暗条纹 ----
  ctx.fillStyle = '#2f7f39';
  ctx.fillRect(0, 0, W, H);
  for (let z = -ENDZONE_DEPTH; z < FIELD_LENGTH + ENDZONE_DEPTH; z += 5) {
    const band = Math.round((z + ENDZONE_DEPTH) / 5);
    ctx.fillStyle = band % 2 === 0 ? '#2b7634' : '#327f3b';
    const y0 = pz(z + 5);
    const y1 = pz(z);
    ctx.fillRect(0, y0, W, y1 - y0);
  }

  // ---- 草叶质感：细短竖线 + 深浅变化，比纯噪点更像草坪 ----
  const rnd = mulberry32(20261101);
  for (let i = 0; i < 16000; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const h = 2 + rnd() * 5;
    ctx.globalAlpha = 0.05 + rnd() * 0.08;
    ctx.fillStyle = rnd() > 0.5 ? '#1d5a25' : '#57a55e';
    ctx.fillRect(x, y, 1.4, h);
  }
  ctx.globalAlpha = 1;

  // ---- 两端端区：球队色渐变 + 端区文字 ----
  const endZone = (z0: number, z1: number) => {
    const y0 = pz(z1);
    const y1 = pz(z0);
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#0b2648');
    g.addColorStop(1, '#123f70');
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, W, y1 - y0);
    // 端区描边
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 0.12 * SY;
    ctx.strokeRect(0, y0, W, y1 - y0);
  };
  endZone(-ENDZONE_DEPTH, 0);
  endZone(FIELD_LENGTH, FIELD_LENGTH + ENDZONE_DEPTH);

  // 端区斜纹
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, pz(FIELD_LENGTH + ENDZONE_DEPTH), W, pz(FIELD_LENGTH) - pz(FIELD_LENGTH + ENDZONE_DEPTH));
  ctx.clip();
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  for (let i = -H; i < W + H; i += 46) {
    ctx.beginPath();
    ctx.moveTo(i, H);
    ctx.lineTo(i + H, 0);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // ---- 码线 / 边线 / 球门线 ----
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 0.14 * SY;
  for (let z = 0; z <= FIELD_LENGTH; z += 5) {
    ctx.beginPath();
    ctx.moveTo(0, pz(z));
    ctx.lineTo(W, pz(z));
    ctx.stroke();
  }
  ctx.lineWidth = 0.2 * SY;
  for (const z of [0, FIELD_LENGTH]) {
    ctx.beginPath();
    ctx.moveTo(0, pz(z));
    ctx.lineTo(W, pz(z));
    ctx.stroke();
  }
  ctx.lineWidth = 0.22 * SX;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(px(side * HALF_WIDTH), 0);
    ctx.lineTo(px(side * HALF_WIDTH), H);
    ctx.stroke();
  }

  // ---- 哈希线（每码短横线，两侧各一道）----
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 0.07 * SY;
  for (const hx of [-HALF_WIDTH * 0.5, HALF_WIDTH * 0.5]) {
    for (let z = 1; z < FIELD_LENGTH; z += 1) {
      if (z % 5 === 0) continue;
      ctx.beginPath();
      ctx.moveTo(px(hx - 0.4), pz(z));
      ctx.lineTo(px(hx + 0.4), pz(z));
      ctx.stroke();
    }
  }

  // ---- 码数（10/20/30/40，左右各一）----
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(1.9 * SY)}px system-ui, "Arial Black", sans-serif`;
  for (const z of [10, 20, 30, 40]) {
    const label = String(z);
    for (const side of [-1, 1]) {
      ctx.fillText(label, px(side * (HALF_WIDTH - 4.4)), pz(z));
    }
  }

  // ---- 端区文字（只画远端，近端离相机太近会被放得很大）----
  ctx.font = `900 ${Math.round(2.1 * SY)}px system-ui, "Arial Black", sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FFSIMU', px(0), pz(FIELD_LENGTH + ENDZONE_DEPTH / 2));

  // ---- 中圈 + 开球点 ----
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 0.12 * SX;
  ctx.beginPath();
  ctx.arc(px(0), pz(FIELD_LENGTH / 2), 5 * SX, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.font = `900 ${Math.round(2.4 * SY)}px system-ui, "Arial Black", sans-serif`;
  ctx.fillText('FLAG BOWL', px(0), pz(FIELD_LENGTH / 2));

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.flipY = false;
  return tex;
}

/**
 * 低多边形球员（有四肢）：躯干 + 肩甲 + 头盔 + 双臂 + 双腿 + 双腰旗。
 * 手臂以肩为轴、腿以髋为轴摆动（跑动动画由外部驱动）。
 */
export function makePlayer(jerseyColor: number, skinColor: number): PlayerRig {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const modelHolder = new THREE.Group();
  group.add(modelHolder);
  const jersey = new THREE.MeshStandardMaterial({ color: jerseyColor, roughness: 0.72 });
  const jerseyDark = new THREE.MeshStandardMaterial({
    color: new THREE.Color(jerseyColor).multiplyScalar(0.78),
    roughness: 0.8,
  });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.85 });

  // 躯干：胶囊体 + 肩甲，比纯方块更像穿着球衣的运动员
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.5, 4, 12), jersey);
  torso.scale.set(1, 1, 0.66);
  torso.position.y = 1.42;
  body.add(torso);
  const pads = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.44, 3, 10), jerseyDark);
  pads.rotation.z = Math.PI / 2;
  pads.position.y = 1.72;
  pads.scale.set(1, 1, 0.78);
  body.add(pads);

  // 头部挂点：几何头盔 + 面罩（可被真实模型替换）
  const headAnchor = new THREE.Group();
  headAnchor.position.y = 2.02;
  body.add(headAnchor);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), jerseyDark);
  helmet.scale.set(1, 0.9, 1.08);
  headAnchor.add(helmet);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.14), skin);
  face.position.set(0, -0.07, 0.19);
  headAnchor.add(face);
  // 面罩横条
  const barMat = new THREE.MeshStandardMaterial({ color: 0xdfe6f2, roughness: 0.4, metalness: 0.6 });
  for (const dy of [-0.02, -0.09]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.03), barMat);
    bar.position.set(0, dy, 0.25);
    headAnchor.add(bar);
  }

  // 四肢：以肩/髋为轴的摆动组
  const limb = (cx: number, y: number, len: number, rad: number, mat: THREE.Material) => {
    const pivot = new THREE.Group();
    pivot.position.set(cx, y, 0);
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len, 4, 10), mat);
    seg.position.y = -len / 2 - 0.04;
    pivot.add(seg);
    body.add(pivot);
    return pivot;
  };
  const armL = limb(-0.34, 1.66, 0.48, 0.085, skin);
  const armR = limb(0.34, 1.66, 0.48, 0.085, skin);
  const legL = limb(-0.16, 0.98, 0.56, 0.105, jerseyDark);
  const legR = limb(0.16, 0.98, 0.56, 0.105, jerseyDark);

  // 两条腰旗（黄色，挂髋部两侧）
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xffd600, roughness: 0.55 });
  for (const side of [-1, 1]) {
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.12), flagMat);
    flag.position.set(side * 0.29, 0.99, 0.02);
    body.add(flag);
  }

  // 影子圆片（比实时阴影便宜且稳定）
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  return { group, body, modelHolder, armL, armR, legL, legR, headAnchor, jerseyColor };
}

/** 跑动摆臂摆腿动画：phase 0..2π；running=false 时轻微待机摆动 */
export function animateRig(rig: PlayerRig, phase: number, running: boolean): void {
  const amp = running ? 0.85 : 0.06;
  rig.legL.rotation.x = Math.sin(phase) * amp;
  rig.legR.rotation.x = -Math.sin(phase) * amp;
  rig.armL.rotation.x = -Math.sin(phase) * amp * 0.7;
  rig.armR.rotation.x = Math.sin(phase) * amp * 0.7;
}

function makeBall(): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a3f16, roughness: 0.55, metalness: 0.05 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12), mat);
  ball.scale.set(1, 0.78, 1.6);
  ball.castShadow = true;
  group.add(ball);
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  for (const dz of [-0.09, 0.09]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.101, 0.101, 0.022, 14, 1, true), stripeMat);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(1, 1, 0.78);
    ring.position.z = dz;
    group.add(ring);
  }
  return group;
}

/** 柏油/水泥地面纹理：细颗粒 + 裂缝 + 边线漆 */
function makeAsphaltTexture(): THREE.CanvasTexture {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#2b2732';
  ctx.fillRect(0, 0, S, S);

  const rnd = mulberry32(4242);
  for (let i = 0; i < 9000; i++) {
    const v = 30 + Math.floor(rnd() * 40);
    ctx.fillStyle = `rgba(${v}, ${v - 2}, ${v + 4}, ${0.25 + rnd() * 0.35})`;
    ctx.fillRect(rnd() * S, rnd() * S, 2, 2);
  }
  // 几道裂缝
  ctx.strokeStyle = 'rgba(12, 10, 16, 0.55)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    let x = rnd() * S;
    let y = rnd() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rnd() - 0.5) * 60;
      y += (rnd() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 10);
  tex.anisotropy = 8;
  return tex;
}
export const SUN_DIR = new THREE.Vector3(0.3, 0.3, 1).normalize();

/**
 * 天空：自定义着色器（天顶深紫 → 品红 → 地平线暖橙）+ 太阳光晕 + 日轮。
 * 比贴图更平滑，也不会有接缝。
 */
function makeSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x1b0f38) },
      midColor: { value: new THREE.Color(0x7a2b60) },
      horizonColor: { value: new THREE.Color(0xff9166) },
      groundColor: { value: new THREE.Color(0x2a1830) },
      sunDir: { value: SUN_DIR.clone() },
      sunColor: { value: new THREE.Color(0xffd2a0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor, midColor, horizonColor, groundColor, sunColor;
      uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col;
        if (h >= 0.0) {
          col = mix(horizonColor, midColor, smoothstep(0.0, 0.32, h));
          col = mix(col, topColor, smoothstep(0.22, 0.85, h));
        } else {
          col = mix(horizonColor, groundColor, smoothstep(0.0, -0.12, -h));
        }
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * pow(s, 10.0) * 0.28;   // 大范围晚霞
        col += sunColor * pow(s, 220.0) * 0.9;   // 近太阳的光晕
        col += sunColor * smoothstep(0.99955, 0.99985, s) * 1.6; // 日轮
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 40, 24), mat);
  sky.position.set(0, 0, FIELD_LENGTH / 2);
  sky.renderOrder = -1;
  return sky;
}

/**
 * 构建球场场景：黄昏天空 + 草皮 + 街球外景 + QB/WR + 球。
 * 世界坐标：1 unit = 1 yd；x 横向，z 纵深（0=开球线，正=进攻方向），y 向上。
 */
export function buildScene(): FieldObjects {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1430);
  scene.fog = new THREE.Fog(0x8a4a5a, 150, 360);

  scene.add(makeSky());

  // 场地外围：深色柏油 + 混凝土缓冲区，街球场的质感
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x1c1722, roughness: 1 }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.set(0, -0.08, FIELD_LENGTH / 2);
  scene.add(outer);

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_WIDTH + 33, FIELD_TOTAL_LENGTH + 33),
    new THREE.MeshStandardMaterial({ map: makeAsphaltTexture(), roughness: 0.96, metalness: 0 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, -0.04, FIELD_LENGTH / 2);
  scene.add(apron);

  // 场边黄线（街球场常见的团队区标线）
  const paint = new THREE.MeshStandardMaterial({
    color: 0xd9b45a,
    roughness: 0.8,
    emissive: 0x241a08,
    emissiveIntensity: 0.4,
  });
  for (const side of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.22, FIELD_TOTAL_LENGTH + 8), paint);
    line.rotation.x = -Math.PI / 2;
    line.position.set(side * (FIELD_WIDTH / 2 + 2.4), 0.005, FIELD_LENGTH / 2);
    scene.add(line);
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_TOTAL_LENGTH),
    new THREE.MeshStandardMaterial({ map: makeFieldTexture(), roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, FIELD_LENGTH / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  // 黄昏光照：低角度暖色太阳 + 品红环境光 + 冷色补光
  scene.add(new THREE.HemisphereLight(0xffc6a8, 0x3a2c3a, 1.45));
  scene.add(new THREE.AmbientLight(0x6a4a62, 0.65));
  const sun = new THREE.DirectionalLight(0xffb07a, 4.0);
  sun.position.copy(SUN_DIR).multiplyScalar(140);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  // 相机侧冷色补光，避免球员正面死黑
  const fill = new THREE.DirectionalLight(0x9a7ad0, 1.4);
  fill.position.set(-30, 24, -50);
  scene.add(fill);

  // 近场补光：把 QB 和近端草皮从逆光里提出来
  const nearKey = new THREE.PointLight(0xffb488, 90, 70, 2);
  nearKey.position.set(0, 10, -2);
  scene.add(nearKey);
  const midKey = new THREE.PointLight(0xffc49a, 60, 80, 2);
  midKey.position.set(0, 12, 30);
  scene.add(midKey);

  // QB（主场深蓝）位于开球线后 3yd；WR（客场白）位于开球线右侧
  const qb = makePlayer(0x1a3a8f, 0xc68e5f);
  qb.group.position.set(0, 0, -3);
  qb.group.rotation.y = 0; // 面向纵深（跑动方向 +z）
  scene.add(qb.group);

  const wr = makePlayer(0xeceff5, 0x9c6b43);
  wr.group.position.set(5, 0, 0);
  scene.add(wr.group);

  const ball = makeBall();
  ball.position.set(0, 1.4, -2.4); // QB 手中
  scene.add(ball);

  // 程序化开放看台：始终位于相机可视范围之外，不遮挡球场
  const stadium = buildStadium();
  scene.add(stadium);

  return { scene, qb, wr, ball, stadium };
}
