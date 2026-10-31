import * as THREE from 'three';

/** 球场尺寸（码） */
export const FIELD_LENGTH = 50; // 进攻纵深 0~50（不含两端端区）
export const FIELD_WIDTH = 26.7;
export const ENDZONE_DEPTH = 5; // 每侧端区深度

/** 低多边形球员骨架：躯干/头盔/四肢 + 腰旗，四肢可摆动（跑动动画） */
export interface PlayerRig {
  group: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

export interface FieldObjects {
  scene: THREE.Scene;
  qb: PlayerRig;
  wr: PlayerRig;
  ball: THREE.Mesh;
}

/**
 * 整场画在一张 canvas 纹理上（草皮条纹 + 码线 + 码数 + 端区 + 边线），
 * 场地面片仅 1 个 draw call。
 */
function makeFieldTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const totalZ = FIELD_LENGTH + ENDZONE_DEPTH * 2; // 60yd
  const totalX = FIELD_WIDTH;
  const px = (x: number) => ((x + totalX / 2) / totalX) * W;
  const pz = (z: number) => ((z + ENDZONE_DEPTH) / totalZ) * H;

  const stripeA = '#2e7d32';
  const stripeB = '#276c2b';
  ctx.fillStyle = stripeA;
  ctx.fillRect(0, 0, W, H);
  for (let stripe = 0; stripe < 12; stripe++) {
    if (stripe % 2 === 1) continue;
    ctx.fillStyle = stripeB;
    const y0 = pz(stripe * 5);
    const y1 = pz(stripe * 5 + 5);
    ctx.fillRect(0, y0, W, y1 - y0);
  }

  ctx.fillStyle = '#1b5e20';
  ctx.fillRect(0, pz(-ENDZONE_DEPTH), W, pz(0) - pz(-ENDZONE_DEPTH));
  ctx.fillRect(0, pz(FIELD_LENGTH), W, pz(FIELD_LENGTH + ENDZONE_DEPTH) - pz(FIELD_LENGTH));

  ctx.fillStyle = '#ffffff';
  for (let z = 0; z <= FIELD_LENGTH; z += 5) {
    ctx.fillRect(px(-totalX / 2), pz(z) - 1, W, 3);
  }
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let z = 10; z < FIELD_LENGTH; z += 10) {
    const label = z < 50 ? String(z) : String(50 - (z - 50));
    ctx.fillText(label, px(0), pz(z));
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(px(-totalX / 2), pz(-ENDZONE_DEPTH), 5, H);
  ctx.fillRect(px(totalX / 2) - 5, pz(-ENDZONE_DEPTH), 5, H);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * 低多边形球员（有四肢）：躯干 + 头盔 + 双臂 + 双腿 + 双腰旗。
 * 手臂以肩为轴、腿以髋为轴摆动（跑动动画由外部驱动）。
 */
export function makePlayer(jerseyColor: number, skinColor: number): PlayerRig {
  const group = new THREE.Group();
  const jersey = new THREE.MeshStandardMaterial({ color: jerseyColor, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });

  // 躯干
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.34), jersey);
  torso.position.y = 1.36;
  group.add(torso);

  // 头盔 + 面罩
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), jersey);
  helmet.position.y = 2.06;
  helmet.scale.set(1, 0.85, 1.05);
  group.add(helmet);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.18), skin);
  face.position.set(0, 1.99, 0.26);
  group.add(face);

  // 四肢：以肩/髋为轴的摆动组
  const limb = (cx: number, y: number, len: number, rad: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(cx, y, 0);
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len, 4, 10), jersey);
    seg.position.y = -len / 2 - 0.04;
    pivot.add(seg);
    group.add(pivot);
    return pivot;
  };
  const armL = limb(-0.36, 1.66, 0.5, 0.09);
  const armR = limb(0.36, 1.66, 0.5, 0.09);
  const legL = limb(-0.17, 0.98, 0.55, 0.11);
  const legR = limb(0.17, 0.98, 0.55, 0.11);

  // 两条腰旗（黄色，挂髋部两侧）
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xffd600, roughness: 0.6 });
  for (const side of [-1, 1]) {
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.12), flagMat);
    flag.position.set(side * 0.3, 0.98, 0);
    group.add(flag);
  }

  // 影子圆片
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  return { group, armL, armR, legL, legR };
}

/** 跑动摆臂摆腿动画：phase 0..2π；running=false 时轻微待机摆动 */
export function animateRig(rig: PlayerRig, phase: number, running: boolean): void {
  const amp = running ? 0.85 : 0.06;
  rig.legL.rotation.x = Math.sin(phase) * amp;
  rig.legR.rotation.x = -Math.sin(phase) * amp;
  rig.armL.rotation.x = -Math.sin(phase) * amp * 0.7;
  rig.armR.rotation.x = Math.sin(phase) * amp * 0.7;
}

function makeBall(): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.5 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), mat);
  ball.scale.set(1, 0.75, 1.8);
  ball.castShadow = true;
  return ball;
}

/**
 * 构建球场场景：草皮地面 + 灯光 + QB/WR + 球。
 * 世界坐标：1 unit = 1 yd；x 横向，z 纵深（0=开球线，正=进攻方向），y 向上。
 */
export function buildScene(): FieldObjects {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1e);
  scene.fog = new THREE.Fog(0x0a0f1e, 60, 140);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_LENGTH + ENDZONE_DEPTH * 2),
    new THREE.MeshStandardMaterial({ map: makeFieldTexture(), roughness: 0.9 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, FIELD_LENGTH / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  scene.add(new THREE.HemisphereLight(0xbdd7ff, 0x1c3a18, 1.1));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  sun.position.set(18, 42, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.far = 120;
  scene.add(sun);

  // QB（主场深蓝）位于开球线后 3yd；WR（客场白）位于开球线右侧
  const qb = makePlayer(0x1a3a8f, 0xc68e5f);
  qb.group.position.set(0, 0, -3);
  qb.group.rotation.y = Math.PI; // 面向纵深
  scene.add(qb.group);

  const wr = makePlayer(0xe8e8e8, 0x9c6b43);
  wr.group.position.set(5, 0, 0);
  scene.add(wr.group);

  const ball = makeBall();
  ball.position.set(0, 1.4, -2.4); // QB 手中
  scene.add(ball);

  return { scene, qb, wr, ball };
}
