import './style.css';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { animateRig, buildScene, makePlayer, type PlayerRig, type Theme } from './three/scene';
import { loadAnimationClips, loadHelmet, loadPlayerModel } from './three/stadium';
import { attachZoom, createCamera } from './three/camera';
import { createRenderer } from './three/renderer';
import { GameController } from './core/stateMachine';
import { GameState } from './core/types';
import type { PlayResult, PlayResultCode, ThrowType, Vec2, WRAttrs } from './core/types';
import { QB_POS } from './gameplay/playDirector';
import { computeThrow } from './gameplay/ballPhysics';
import { routeLength } from './gameplay/routes';
import { wrSpeedFor } from './gameplay/routeRunner';
import { DEFAULT_WR_CARD } from './data/cards';

import { attachGesture } from './ui/gestures';
import { renderActionMenu } from './ui/playCall';
import { bindSideButtons, openChangelog } from './ui/sideButtons';
import { openProfile, renderProfileChip, renderWallet } from './ui/profile';
import { initAudio, playCatch, playCheer, playMiss, playPass, setVolume } from './audio';
import { loadSettings, saveSettings } from './data/storage';
import { ANIMS_URL, HELMET_MODEL_URL, PLAYER_MODEL_URL, QB_MODEL_URL } from './config';
import type { PlayerModelAsset } from './three/stadium';
import { initPWA } from './pwa';
import {
  isIOS,
  isOnline,
  isStandalone,
  promptInstall,
  watchConnectivity,
  watchInstall,
} from './offline';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`找不到 #${id}`);
  return node as T;
}

function bootError(message: string): void {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('boot-error');
  boot.innerHTML = `<div class="boot-card"><h1>无法启动 3D 球场</h1><p>${message}</p>
    <p class="boot-tip">请换用最新版 Chrome / Edge / Safari，或在设置里关闭「省电模式」后重试。</p></div>`;
}

function main(): void {
  const canvas = el<HTMLCanvasElement>('game-canvas');
  const hudCombo = el('hud-combo');
  const hudAttempts = el('hud-attempts');
  const hudRate = el('hud-rate');
  const throwHint = el('throw-hint');
  const rotateHint = el('portrait-lock');
  const playcallList = el('playcall-list');
  const stage = el('stage');
  const btnGame = el('btn-game');
  const boot = el('boot');
  const updateToast = el('update-toast');
  const netBadge = el('net-badge');
  const installBtn = el<HTMLButtonElement>('btn-install');
  const commentFeed = el('comment-feed');
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- 场景与渲染 ----
  const themeParam = new URLSearchParams(location.search).get('theme');
  const savedTheme: Theme =
    themeParam === 'campus' || themeParam === 'street'
      ? themeParam
      : ((localStorage.getItem('ffp.theme.v1') as Theme | null) ?? 'street');
  const { scene, qb, wr, ball, setTheme, setScore } = buildScene(savedTheme);
  let currentTheme: Theme = savedTheme;
  /** 切换球场外景（街头黄昏 / 校园白天） */
  function applyTheme(t: Theme): void {
    currentTheme = t;
    setTheme(t);
    localStorage.setItem('ffp.theme.v1', t);
  }
  const cameraRig = createCamera();
  let handle: ReturnType<typeof createRenderer> | null = null;
  try {
    handle = createRenderer(canvas, scene, cameraRig.camera);
  } catch (e) {
    bootError('当前浏览器没有可用的 WebGL 2 支持。');
    console.error(e);
    return;
  }
  if (!handle) return;
  attachZoom(canvas, cameraRig); // 滚轮 / 双指捏合缩放

  // ---- 外部模型：真实头盔 / 可选全身球员（失败静默回退几何体） ----
  let helmetTemplate: THREE.Object3D | null = null;
  let playerTemplate: PlayerModelAsset | null = null;
  let qbTemplate: PlayerModelAsset | null = null;
  const defenders: PlayerRig[] = [];
  const DEFENDER_COUNT = 4;

  /** 用真实头盔模型替换球员几何头（按球队主色给外壳调色） */
  function applyHelmet(rig: PlayerRig): void {
    if (!helmetTemplate || playerTemplate) return;
    for (const child of Array.from(rig.headAnchor.children)) rig.headAnchor.remove(child);
    const clone = helmetTemplate.clone(true);
    clone.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // 源模型外壳材质名是 Mat（暗红），按球衣主色重上色
      if (mat.name === 'Mat') {
        const tinted = mat.clone();
        tinted.color.setHex(rig.jerseyColor);
        mesh.material = tinted;
      }
    });
    clone.position.set(0, 0, 0);
    rig.headAnchor.add(clone);
  }

  // ---- 模型 & 动画 ----
  interface RigAnim {
    mixer: THREE.AnimationMixer;
    actions: Record<string, THREE.AnimationAction>;
    current: string;
  }
  const rigAnims = new Map<PlayerRig, RigAnim>();
  let animClips: THREE.AnimationClip[] = [];
  let handBall: THREE.Mesh | null = null;
  let wrHandBone: THREE.Object3D | null = null;
  let selectionCone: THREE.Mesh | null = null;
  const tmpVec = new THREE.Vector3();

  const clipsReady = loadAnimationClips(ANIMS_URL).then((clips) => {
    animClips = clips;
    return clips;
  });

  function actionKey(rig: PlayerRig, key: string): string | null {
    const a = rigAnims.get(rig);
    if (!a) return null;
    const k = Object.keys(a.actions).find((n) => n.toLowerCase().includes(key.toLowerCase()));
    return k ?? null;
  }

  function playClip(
    rig: PlayerRig,
    key: string,
    opts: { once?: boolean; fade?: number; time?: number; timeScale?: number; paused?: boolean } = {},
  ): THREE.AnimationAction | null {
    const a = rigAnims.get(rig);
    const k = actionKey(rig, key);
    if (!a || !k) return null;
    if (a.current === k && opts.time === undefined && !opts.once && !opts.paused) return a.actions[k];
    const action = a.actions[k];
    const prev = a.current && a.actions[a.current] !== action ? a.actions[a.current] : null;
    action.reset();
    action.setLoop(opts.once ? THREE.LoopOnce : THREE.LoopRepeat, opts.once ? 1 : Infinity);
    action.clampWhenFinished = !!opts.once;
    action.timeScale = opts.timeScale ?? 1;
    if (opts.time !== undefined) action.time = opts.time;
    action.paused = !!opts.paused;
    action.fadeIn(opts.fade ?? 0.18).play();
    if (prev) prev.fadeOut(opts.fade ?? 0.18);
    a.current = k;
    if (opts.paused) a.mixer.update(0);
    return action;
  }

  function applyModel(rig: PlayerRig, asset: PlayerModelAsset, tint?: number): void {
    rig.body.visible = false;
    rig.modelHolder.clear();
    const clone = cloneSkeleton(asset.scene);
    if (tint !== undefined) {
      clone.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.color.setHex(tint);
        mesh.material = mat;
      });
    }
    rig.modelHolder.add(clone);

    const mixer = new THREE.AnimationMixer(clone);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of animClips.length ? animClips : asset.animations) {
      actions[clip.name] = mixer.clipAction(clip);
    }
    rigAnims.set(rig, { mixer, actions, current: '' });
    if (rig === qb) {
      // 四分卫：静止时停在传球动作 4.5s 的持球站姿
      playClip(rig, 'Pass', { time: 4.5, paused: true, fade: 0.2 });
      attachHandBall(clone);
      // 去掉脚下的圆形阴影，改为头顶旋转三角锥（选中提示）
      rig.group.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry?.type === 'CircleGeometry') mesh.visible = false;
      });
      if (!selectionCone) {
        selectionCone = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 0.22, 4),
          new THREE.MeshStandardMaterial({
            color: 0xffc23a,
            emissive: 0xff8a00,
            emissiveIntensity: 1.4,
            transparent: true,
            opacity: 0.92,
          }),
        );
        selectionCone.rotation.x = Math.PI;
        selectionCone.position.set(0, 2.32, 0);
        selectionCone.castShadow = false;
        rig.group.add(selectionCone);
      }
    } else {
      // 外接手：起跑前是「准备起跑」姿态（不再用中锋开球那种叉腿站姿）
      playClip(rig, 'Run', { time: 0.08, paused: true, fade: 0.2 });
      if (rig === wr) {
        // 接住后把球吸附到外接手右手
        clone.traverse((n) => {
          if (wrHandBone) return;
          const name = n.name.toLowerCase().replace(/[^a-z]/g, '');
          if (name.endsWith('righthand')) wrHandBone = n;
        });
      }
    }
  }

  /** 小橄榄球绑到右手骨骼；用世界缩放换算尺寸，避免被骨骼缩放放大/缩小 */
  function attachHandBall(clone: THREE.Object3D): void {
    let bone: THREE.Object3D | undefined =
      clone.getObjectByName('mixamorig:RightHand') ?? clone.getObjectByName('mixamorigRightHand');
    if (!bone) {
      // GLTFLoader 会清洗骨骼名（去掉冒号），这里按名字后缀兜底查找
      clone.traverse((n) => {
        if (bone) return;
        const name = n.name.toLowerCase().replace(/[^a-z]/g, '');
        if (name.endsWith('righthand')) bone = n;
      });
    }
    if (!bone) {
      console.warn('[ball] 未找到右手骨骼');
      return;
    }
    const geo = new THREE.SphereGeometry(0.085, 14, 10);
    geo.scale(1, 0.78, 1.55);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x7a3f16, roughness: 0.55 }));
    bone.updateWorldMatrix(true, false);
    const s = new THREE.Vector3();
    bone.getWorldScale(s);
    const k = 1 / (s.x || 1);
    mesh.scale.setScalar(k);
    mesh.position.set(0, 0.05 * k, 0);
    mesh.castShadow = true;
    bone.add(mesh);
    handBall = mesh;
  }

  /** 用全身球员模型替换几何身体 */
  function applyPlayerModel(rig: PlayerRig): void {
    if (!playerTemplate) return;
    if (rig === qb && qbTemplate) return;
    applyModel(rig, playerTemplate, rig === wr ? 0xcfe0ff : undefined);
  }

  void clipsReady.then(() => {
    void loadHelmet(HELMET_MODEL_URL).then((template) => {
      if (!template) return;
      helmetTemplate = template;
      for (const rig of [qb, wr, ...defenders]) applyHelmet(rig);
    });
    if (PLAYER_MODEL_URL) {
      void loadPlayerModel(PLAYER_MODEL_URL).then((template) => {
        if (!template) return;
        playerTemplate = template;
        for (const rig of [qb, wr, ...defenders]) applyPlayerModel(rig);
      });
    }
    if (QB_MODEL_URL) {
      void loadPlayerModel(QB_MODEL_URL).then((template) => {
        if (!template) return;
        qbTemplate = template;
        applyModel(qb, qbTemplate);
      });
      // 外接手也用同一套动态模型（跑步/接球动作），浅色球衣区分
      void loadPlayerModel(QB_MODEL_URL).then((template) => {
        if (!template) return;
        playerTemplate = template;
        applyModel(wr, template, 0xcfe0ff);
      });
    }
  });

  // ---- 模式：主页练习（单球员接球） / 模拟比赛（QB+WR+防守） ----
  type Mode = 'practice' | 'game';
  let mode: Mode = 'practice';
  /** 路线镜像：1 = 屏幕左侧（x>0），-1 = 屏幕右侧 */
  let routeSide: 1 | -1 = 1;
  let defenseScheme: 'man' | 'zone' = 'man';

  const sideToggle = el('side-toggle');
  const defToggle = el('def-toggle');
  const resetBtn = el('reset-btn');
  const snapBtn = el('snap-btn');

  function syncOptionLabels(): void {
    sideToggle.textContent = routeSide === 1 ? '左侧路线' : '右侧路线';
    defToggle.textContent = defenseScheme === 'man' ? '防守 · 人盯人' : '防守 · 区域';
  }
  syncOptionLabels();
  sideToggle.addEventListener('click', () => {
    routeSide = routeSide === 1 ? -1 : 1;
    syncOptionLabels();
    if (controller.state === GameState.PLAY_CALL || controller.state === GameState.RESULT) resetToStart();
  });
  defToggle.addEventListener('click', () => {
    defenseScheme = defenseScheme === 'man' ? 'zone' : 'man';
    syncOptionLabels();
  });
  resetBtn.addEventListener('click', () => resetToStart());

  let snapTimer: number | undefined;
  snapBtn.addEventListener('click', () => {
    // 开球：WR 起跑，QB 接球后撤观察，4.5s 处停住等传球
    if (!controller.snap()) {
      showToast('先选一个战术，再开球');
      return;
    }
    rigAnims.forEach((a) => (a.mixer.timeScale = 1));
    playClip(qb, 'Pass', { time: 0, timeScale: 1, fade: 0.15 });
    if (handBall) handBall.visible = true;
    window.clearTimeout(snapTimer);
    snapTimer = window.setTimeout(() => {
      const qa = rigAnims.get(qb);
      const key = qa && Object.keys(qa.actions).find((n) => n.toLowerCase().includes('pass'));
      const act = key && qa!.actions[key];
      if (act) {
        act.paused = true;
        act.time = 4.5;
      }
    }, 4200);
  });

  /** 复位：球员回到初始站位并静止（不再一直循环播放待机动画） */
  function resetToStart(): void {
    controller.reset();
    if (freezeTimer) clearTimeout(freezeTimer);
    rigAnims.forEach((a) => (a.mixer.timeScale = 1));
    routePreview.visible = false;
    postCatch.t = 0;
    ballSim.active = false;
    catchTriggered = false;
    wrCatch = false;
    if (handBall) handBall.visible = true;
    ball.visible = true;
    wr.group.position.set(routeSide * 5, 0, 0);
    wr.group.rotation.y = 0;
    playClip(wr, 'Run', { time: 0.08, paused: true, fade: 0.15 });
    playClip(qb, 'Pass', { time: 4.5, paused: true, fade: 0.2 });
    ball.position.set(0, 1.4, -2.4);
  }

  function applyMode(): void {
    // 练习模式也保留 QB（传球目标就在他身上），比赛模式额外上防守球员
    btnGame.querySelector('span')!.textContent = mode === 'game' ? '训练' : '比赛';
  }

  /** 比赛模式：防守球员按战术站位上场，返回站位（供判定用） */
  function spawnDefenders(): Vec2[] {
    for (const d of defenders) scene.remove(d.group);
    defenders.length = 0;
    const positions: Vec2[] = [];
    for (let i = 0; i < DEFENDER_COUNT; i++) {
      const rig = makePlayer(0x8f1a1a, 0x7a4b2c);
      applyHelmet(rig);
      applyPlayerModel(rig);
      let x: number;
      let z: number;
      if (defenseScheme === 'man') {
        // 人盯人：贴着外接手起跑线一侧，前后错位
        x = routeSide * (4 + i * 1.8) + (Math.random() - 0.5) * 2;
        z = 2.5 + i * 2.2 + Math.random() * 1.5;
      } else {
        // 区域：横向铺开的区域防守
        x = (i - 1.5) * 5.5 + (Math.random() - 0.5) * 2;
        z = 8 + (i % 2) * 4 + Math.random() * 2;
      }
      x = Math.round(Math.max(-12, Math.min(12, x)) * 10) / 10;
      z = Math.round(z * 10) / 10;
      rig.group.position.set(x, 0, z);
      rig.group.rotation.y = Math.PI; // 面向 QB
      scene.add(rig.group);
      defenders.push(rig);
      positions.push({ x, z });
    }
    return positions;
  }

  applyMode();

  // ---- 蓄力环 ----
  const chargeRing = document.createElement('div');
  chargeRing.className = 'charge-ring hidden';
  stage.appendChild(chargeRing);

  // ---- 状态机与事件 ----
  let totalComplete = 0;
  let resultTimer: ReturnType<typeof setTimeout> | null = null;
  let freezeTimer: ReturnType<typeof setTimeout> | null = null;
  const wrSpeed = wrSpeedFor((DEFAULT_WR_CARD.attrs as WRAttrs).SPD);

  function updateHud(): void {
    hudCombo.textContent = String(controller.combo);
    hudAttempts.textContent = String(controller.attempts);
    const rate = controller.attempts > 0 ? `${Math.round((totalComplete / controller.attempts) * 100)}%` : '—';
    hudRate.textContent = rate;
    // 校园大屏同步
    setScore?.(controller.combo, controller.attempts, rate);
  }

  // ---- 右下角评论区（抖音风格）----
  const COMMENT_NAMES = ['看球的老王', '战术板', '端区钉子户', '夜跑选手', '8号球衣', '边线记者', '站在围栏外', '替补四分卫'];
  const COMMENT_COLORS = ['#ff6b6b', '#4ecdc4', '#ffd166', '#a78bfa', '#f472b6', '#60a5fa'];

  function pushComment(text: string, tone: 'good' | 'bad' | 'perfect'): void {
    const item = document.createElement('div');
    item.className = `comment ${tone}`;
    const name = COMMENT_NAMES[Math.floor(Math.random() * COMMENT_NAMES.length)];
    const color = COMMENT_COLORS[Math.floor(Math.random() * COMMENT_COLORS.length)];
    item.innerHTML = `<span class="cm-avatar" style="background:${color}">${name.slice(0, 1)}</span>
      <span class="cm-body"><b>${name}</b><span class="cm-text">${text}</span></span>`;
    commentFeed.appendChild(item);
    while (commentFeed.children.length > 4) commentFeed.firstElementChild?.remove();
    setTimeout(() => {
      item.classList.add('leaving');
      setTimeout(() => item.remove(), 380);
    }, 4200);
  }

  function commentFor(code: PlayResultCode, dynamic: boolean): { text: string; tone: 'good' | 'bad' | 'perfect' } {
    switch (code) {
      case 'complete':
        return dynamic ? { text: '完美接球！', tone: 'perfect' } : { text: '接球完成', tone: 'good' };
      case 'drop':
        return { text: '差一点！', tone: 'bad' };
      case 'defensed':
        return { text: '接球失败', tone: 'bad' };
      case 'overthrow':
        return { text: '传大了', tone: 'bad' };
      case 'underthrow':
        return { text: '传短了', tone: 'bad' };
      case 'wide':
        return { text: '传偏了', tone: 'bad' };
      case 'tooLate':
        return { text: '出手太晚', tone: 'bad' };
    }
  }

  // ---- 接球后继续推进 / 球弹地物理 ----
  const postCatch = { t: 0, pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1) };
  let wrCatch = false;
  let catchTriggered = false;
  const ballSim = { active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), bounces: 0 };

  function startPostCatch(): void {
    postCatch.t = 2;
    postCatch.pos.set(wr.group.position.x, 0, wr.group.position.z);
    const v = controller.director?.runner.vel;
    if (v && (Math.abs(v.x) > 0.01 || Math.abs(v.z) > 0.01)) postCatch.dir.set(v.x, 0, v.z).normalize();
    else postCatch.dir.set(0, 0, 1);
    playClip(wr, 'Run', { fade: 0.15 });
  }

  function startBallBounce(result: PlayResult): void {
    if (result.code === 'drop') {
      ballSim.pos.set(result.wrPosAtCatch.x, 1.5, result.wrPosAtCatch.z);
      ballSim.vel.set((Math.random() - 0.5) * 2.2, 1.7, 1.2 + Math.random());
    } else {
      ballSim.pos.set(result.landing.x, 0.4, result.landing.z);
      ballSim.vel.set((Math.random() - 0.5) * 2.4, 2.2, 0.8 + Math.random() * 1.6);
    }
    ballSim.bounces = 0;
    ballSim.active = true;
    ball.visible = true;
  }

  function qbThrowPose(): void {
    const a = playClip(qb, 'Pass', { once: true, time: 4.05, timeScale: 1.5, fade: 0.1 });
    if (!a) return;
    if (handBall) handBall.visible = false;
    ball.visible = true;
    setTimeout(() => {
      // 投完平滑回到待机，避免姿势硬切造成「断续」
      playClip(qb, 'Idle', { fade: 0.45 });
      if (handBall) handBall.visible = true;
    }, 2450);
  }

  /** 限制在围栏内（避免接球后冲出场地） */
  function clampFence(p: THREE.Vector3): void {
    p.x = THREE.MathUtils.clamp(p.x, -15.4, 15.4);
    p.z = THREE.MathUtils.clamp(p.z, -7.5, 56);
  }

  /**
   * 跑步动画按速度重采样：每个循环前进约 2.6 码，
   * 由速度反推播放倍率，脚部与地面位移对齐（减少滑步）。
   */
  function syncRunSpeed(): void {
    const a = rigAnims.get(wr);
    if (!a) return;
    const key = Object.keys(a.actions).find((n) => n.toLowerCase().includes('run'));
    if (!key) return;
    const act = a.actions[key];
    const dur = act.getClip().duration || 0.73;
    const STRIDE_LEN = 2.6;
    act.timeScale = THREE.MathUtils.clamp((wrSpeed / STRIDE_LEN) * dur, 0.8, 2.2);
  }

  /** 角度插值：让转身是连续的，而不是瞬间跳转 */
  function smoothAngle(current: number, target: number, t: number): number {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * Math.min(1, t);
  }

  // ---- 路线预览（草地上半透明虚线，开球后才消失）----
  const routePreviewMat = new THREE.LineDashedMaterial({
    color: 0x9dffb0,
    dashSize: 0.55,
    gapSize: 0.3,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const routePreview = new THREE.Line(new THREE.BufferGeometry(), routePreviewMat);
  routePreview.position.y = 0.05;
  routePreview.visible = false;
  scene.add(routePreview);

  /** 选中战术后：画路线 + 让 WR 站在起点（静止） */
  function updateRoutePreview(): void {
    const play = controller.play;
    if (!play || controller.state !== GameState.PLAY_CALL) {
      routePreview.visible = false;
      return;
    }
    const pts = play.route.points.map((p) => new THREE.Vector3(p.x, 0, p.z));
    routePreview.geometry.dispose();
    routePreview.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    routePreview.computeLineDistances();
    routePreview.visible = true;
    const p0 = play.route.points[0];
    wr.group.position.set(p0 ? p0.x : routeSide * 5, 0, p0 ? p0.z : 0);
    wr.group.rotation.y = 0;
    playClip(wr, 'Run', { time: 0.08, paused: true, fade: 0.15 });
  }

  const controller = new GameController({
    onStateChange: (state) => {
      const idle = state === GameState.PLAY_CALL || state === GameState.RESULT;
      playCall.setEnabled(idle);
      throwHint.classList.toggle('hidden', state !== GameState.ROUTE);
      if (state !== GameState.ROUTE) chargeRing.classList.add('hidden');
      if (idle) playCall.closeCards();
    },
    onSelect: () => {
      updateRoutePreview();
    },
    onSnap: (play) => {
      playCall.setSelected(play.id);
      catchTriggered = false;
      wrCatch = false;
      postCatch.t = 0;
      ballSim.active = false;
      routePreview.visible = false;
      rigAnims.forEach((a) => (a.mixer.timeScale = 1));
      if (handBall) handBall.visible = true;
      playClip(wr, 'Run', { fade: 0.15 });
    },
    onResult: (result, play) => {
      const duration = routeLength(play.route) / wrSpeed;
      const dynamic = result.code === 'complete' && result.tCatch < duration;
      if (result.code === 'complete') totalComplete += 1;
      const c = commentFor(result.code, dynamic);
      pushComment(c.text, c.tone);
      if (result.code === 'complete') {
        playCatch();
        if (dynamic) playCheer();
      } else {
        playMiss();
      }
      wrCatch = false;
      if (result.code === 'complete') startPostCatch();
      else startBallBounce(result);
      updateHud();
      // 传球完成后 2 秒，所有球员动画停止（定格），避免一直跑
      if (freezeTimer) clearTimeout(freezeTimer);
      freezeTimer = setTimeout(() => {
        rigAnims.forEach((a) => (a.mixer.timeScale = 0));
      }, 2000);
      if (resultTimer) clearTimeout(resultTimer);
      resultTimer = setTimeout(() => controller.nextPlay(), 2600);
    },
  });

  const playCall = renderActionMenu(playcallList, {
    onSelectPlay: (id) => {
      controller.selectPlay(id, mode === 'game' ? spawnDefenders() : undefined, routeSide);
    },
  });
  playCall.setEnabled(true);
  updateHud();

  // ---- 模拟比赛按钮 ----
  btnGame.addEventListener('click', () => {
    mode = mode === 'game' ? 'practice' : 'game';
    applyMode();
    if (mode === 'game') {
      spawnDefenders();
    } else {
      for (const d of defenders) scene.remove(d.group);
      defenders.length = 0;
    }
  });

  // ---- 手势：轻点 = 高球 lob，长按 = 平快球 bullet ----
  function doThrow(type: ThrowType): void {
    if (controller.state !== GameState.ROUTE) return;
    controller.throwBall(type);
    playPass();
    const r = controller.lastResult;
    // 小概率脱手：判断为接住但手滑，球会弹地
    if (r && r.code === 'complete' && Math.random() < 0.12) r.code = 'drop';
    qbThrowPose();
  }

  attachGesture(canvas, {
    onHoldStart: () => {
      if (controller.state === GameState.ROUTE) chargeRing.classList.remove('hidden');
    },
    onTap: () => {
      chargeRing.classList.add('hidden');
      doThrow('lob');
    },
    onHold: () => {
      chargeRing.classList.add('hidden');
      doThrow('bullet');
    },
    onCancel: () => chargeRing.classList.add('hidden'),
  });

  // ---- 锥桶点击：小幅度翻倒 ----
  const coneMeshes: THREE.Mesh[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.userData.cone) coneMeshes.push(m);
  });
  const toppling: Array<{ mesh: THREE.Mesh; t: number; dir: number }> = [];
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  canvas.addEventListener('pointerup', (e) => {
    if (controller.state === GameState.ROUTE) return;
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, cameraRig.camera);
    const hit = raycaster.intersectObjects(coneMeshes, false)[0];
    if (!hit) return;
    const mesh = hit.object as THREE.Mesh;
    if (toppling.some((t) => t.mesh === mesh)) return;
    toppling.push({ mesh, t: 0, dir: Math.random() < 0.5 ? 1 : -1 });
  });

  // ---- 渲染循环：状态机驱动 + 画面同步 ----
  let runPhase = 0;
  let idlePhase = 0;
  let booted = false;

  handle.onFrame = (dt) => {
    if (!booted) {
      booted = true;
      requestAnimationFrame(() => boot.classList.add('hidden'));
    }

    controller.update(dt);
    rigAnims.forEach((a) => a.mixer.update(dt));
    // 锥桶翻倒动画
    for (let i = toppling.length - 1; i >= 0; i--) {
      const c = toppling[i];
      c.t += dt;
      const k = Math.min(c.t / 0.45, 1);
      const e = 1 - Math.pow(1 - k, 3);
      c.mesh.rotation.z = c.dir * (Math.PI / 2) * e;
      c.mesh.position.y = 0.26 - 0.07 * e;
      if (k >= 1) toppling.splice(i, 1);
    }
    // 头顶选中三角锥：缓慢旋转 + 轻微浮动
    if (selectionCone) {
      selectionCone.rotation.y += dt * 2.4;
      selectionCone.position.y = 2.32 + Math.sin(performance.now() / 700) * 0.05;
    }
    const d = controller.director;
    const moving = !!d && !d.runner.done;
    const state = controller.state;

    // 接球成功后继续往前跑 2 秒，再站定
    if (postCatch.t > 0) {
      postCatch.t -= dt;
      postCatch.pos.addScaledVector(postCatch.dir, wrSpeed * dt);
      clampFence(postCatch.pos);
      wr.group.position.copy(postCatch.pos);
      wr.group.rotation.y = Math.atan2(postCatch.dir.x, postCatch.dir.z);
      runPhase += dt * 10;
      if (!rigAnims.has(wr)) animateRig(wr, runPhase, true);
      if (postCatch.t <= 0) playClip(wr, 'Idle', { fade: 0.25 });
    } else if (d && state !== GameState.RESULT && state !== GameState.RESOLVE) {
      wr.group.position.set(d.runner.pos.x, 0, d.runner.pos.z);
      clampFence(wr.group.position);
      if (moving) {
        const targetYaw = Math.atan2(d.runner.vel.x, d.runner.vel.z);
        wr.group.rotation.y = smoothAngle(wr.group.rotation.y, targetYaw, dt * 9);
        runPhase += dt * 10;
        if (!rigAnims.has(wr)) animateRig(wr, runPhase, true);
        if (!wrCatch) {
          playClip(wr, 'Run', { fade: 0.2 });
          syncRunSpeed();
        }
      } else {
        idlePhase += dt;
        if (!rigAnims.has(wr)) animateRig(wr, idlePhase * 2, false);
        if (!wrCatch) playClip(wr, 'Idle', { fade: 0.3 });
      }
    } else if (!rigAnims.has(wr)) {
      idlePhase += dt;
      animateRig(wr, idlePhase * 2, false);
    }

    // QB / 防守球员待机
    idlePhase += dt * 0.5;
    if (!rigAnims.has(qb)) animateRig(qb, idlePhase, false);
    for (let i = 0; i < defenders.length; i++) animateRig(defenders[i], idlePhase + i, false);

    switch (state) {
      case GameState.PLAY_CALL:
      case GameState.SNAP:
      case GameState.ROUTE: {
        if (handBall) {
          ball.visible = false;
        } else {
          ball.visible = true;
          const t = performance.now() / 1000;
          if (mode === 'game') {
            ball.position.set(qb.group.position.x, 1.35 + Math.sin(t * 2) * 0.03, qb.group.position.z + 0.3);
          } else {
            ball.position.set(QB_POS.x, 1.35 + Math.sin(t * 2) * 0.03, QB_POS.z + 0.3);
          }
        }
        break;
      }
      case GameState.USER_THROW:
      case GameState.BALL_FLIGHT: {
        ball.visible = true;
        if (controller.lastResult) {
          const r = controller.lastResult;
          const traj = computeThrow(QB_POS, r.landing, r.throwType);
          const p = traj.posAt(controller.ballProgress);
          ball.position.set(p.x, 1.4 + traj.heightAt(controller.ballProgress), p.z);
          // 球快到手时提前做接球动作
          if (!catchTriggered) {
            const flight = Math.max(0.001, r.tCatch - r.tThrow);
            if (flight * (1 - controller.ballProgress) <= 0.65) {
              catchTriggered = true;
              wrCatch = true;
              playClip(wr, 'Catch', { once: true, fade: 0.12 });
            }
          }
        }
        break;
      }
      case GameState.RESOLVE:
      case GameState.RESULT: {
        ball.visible = true;
        if (ballSim.active) {
          ballSim.vel.y -= 10.7 * dt;
          ballSim.pos.addScaledVector(ballSim.vel, dt);
          if (ballSim.pos.y < 0.12) {
            ballSim.pos.y = 0.12;
            ballSim.vel.y = -ballSim.vel.y * 0.45;
            ballSim.vel.x *= 0.7;
            ballSim.vel.z *= 0.7;
            ballSim.bounces += 1;
            if (ballSim.bounces > 4 || Math.abs(ballSim.vel.y) < 0.6) {
              ballSim.active = false;
              ballSim.vel.set(0, 0, 0);
            }
          }
          ball.position.copy(ballSim.pos);
          ball.rotation.x += dt * 8;
          ball.rotation.z += dt * 4;
        } else if (controller.lastResult) {
          const r = controller.lastResult;
          if (r.code === 'complete') {
            // 接住后球紧贴外接手右手
            if (wrHandBone) {
              wrHandBone.getWorldPosition(tmpVec);
              ball.position.copy(tmpVec);
            } else {
              ball.position.set(wr.group.position.x, 1.45, wr.group.position.z + 0.15);
            }
          } else {
            ball.position.set(r.landing.x, 0.3, r.landing.z);
          }
        }
        break;
      }
    }
  };
  handle.start();

  // ---- 只支持横屏：竖屏时锁定并提示 ----
  function syncOrientation(): void {
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    rotateHint.classList.toggle('hidden', !portrait);
    if (!portrait) {
      // 在 PWA / 全屏下尝试锁定横屏（iOS 不支持时静默失败）
      try {
        void (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
      } catch {
        /* ignore */
      }
    }
  }
  syncOrientation();
  window.addEventListener('orientationchange', syncOrientation);
  window.addEventListener('resize', syncOrientation);

  // ---- 设置应用 + 侧边按钮 ----
  const pwa = initPWA({
    onUpdateReady: () => updateToast.classList.remove('hidden'),
    onOfflineReady: () => showToast('✅ 已缓存，可离线游玩'),
  });

  const settings = loadSettings();
  initAudio(settings.volume);
  renderProfileChip();
  renderWallet();
  el('profile-chip').addEventListener('click', () =>
    openProfile({ onSaved: () => renderProfileChip(), theme: currentTheme, onTheme: applyTheme }),
  );

  handle.setQuality(settings.quality);
  handle.onQualityChange = (q) => saveSettings({ ...loadSettings(), quality: q });
  bindSideButtons({
    onQualityChange: (q) => handle.setQuality(q),
    onSelectPlay: (id) => controller.selectPlay(id, mode === 'game' ? spawnDefenders() : undefined, routeSide),
    onCheckUpdate: () => {
      if (!isOnline()) {
        showToast('离线状态，联网后再检查更新');
        return;
      }
      void pwa.checkUpdate().then((hasUpdate) => {
        if (hasUpdate) {
          updateToast.classList.remove('hidden');
          showToast('发现新版本，点击「立即更新」');
        } else {
          showToast('已是最新版本');
        }
      });
    },
    notify: showToast,
    onWalletChange: renderWallet,
    onVolumeChange: (v) => setVolume(v),
  });

  // ---- 更新提示 ----
  el('update-now').addEventListener('click', () => pwa.applyUpdate());
  el('update-later').addEventListener('click', () => updateToast.classList.add('hidden'));
  el('update-notes').addEventListener('click', () => {
    updateToast.classList.add('hidden');
    openChangelog();
  });

  // ---- 离线状态：核心玩法继续，联网功能降级 ----
  let firstConnectivity = true;
  watchConnectivity((online) => {
    netBadge.classList.toggle('hidden', online);
    if (firstConnectivity) {
      firstConnectivity = false;
      return;
    }
    showToast(online ? '🌐 已恢复联网' : '📴 离线模式：可继续玩，商城等联网功能暂停');
  });

  // ---- 安装到桌面（离线包的入口）----
  watchInstall((canInstall) => {
    installBtn.classList.toggle('hidden', !(canInstall || isIOS()) || isStandalone());
  });
  installBtn.addEventListener('click', () => {
    void (async () => {
      if (await promptInstall()) {
        showToast('已开始安装，完成后可从主屏幕直接进入');
        return;
      }
      showToast(isIOS() ? 'Safari：点分享按钮 → 添加到主屏幕' : '浏览器菜单 → 安装应用 / 添加到主屏幕');
    })();
  });

  // ---- 轻量 toast ----
  function showToast(text: string): void {
    const toast = el('toast');
    toast.textContent = text;
    toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
  }
}

main();
