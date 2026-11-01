import './style.css';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { animateRig, buildScene, makePlayer, type PlayerRig } from './three/scene';
import { loadHelmet, loadPlayerModel } from './three/stadium';
import { attachZoom, createCamera } from './three/camera';
import { createRenderer } from './three/renderer';
import { GameController, resultHeadline, resultSubline } from './core/stateMachine';
import { GameState } from './core/types';
import type { Vec2, WRAttrs } from './core/types';
import { QB_POS } from './gameplay/playDirector';
import { computeThrow } from './gameplay/ballPhysics';
import { routeLength } from './gameplay/routes';
import { wrSpeedFor } from './gameplay/routeRunner';
import { DEFAULT_WR_CARD } from './data/cards';
import { PLAYS } from './data/plays';
import { attachGesture } from './ui/gestures';
import { renderActionMenu } from './ui/playCall';
import { bindSideButtons } from './ui/sideButtons';
import { loadSettings, saveSettings } from './data/storage';
import { HELMET_MODEL_URL, PLAYER_MODEL_URL, QB_MODEL_URL } from './config';
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
  const resultBanner = el('result-banner');
  const rotateHint = el('rotate-hint');
  const playcallList = el('playcall-list');
  const stage = el('stage');
  const btnGame = el('btn-game');
  const boot = el('boot');
  const updateToast = el('update-toast');
  const netBadge = el('net-badge');
  const installBtn = el<HTMLButtonElement>('btn-install');
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- 场景与渲染 ----
  const { scene, qb, wr, ball } = buildScene();
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

  /** 用真实球员模型替换几何身体，并播放模型自带的动画 */
  const playerMixers: Array<{ mixer: THREE.AnimationMixer; rig: PlayerRig }> = [];

  function applyModel(rig: PlayerRig, asset: PlayerModelAsset): void {
    rig.body.visible = false;
    rig.modelHolder.clear();
    const clone = cloneSkeleton(asset.scene);
    rig.modelHolder.add(clone);
    if (asset.animations.length) {
      const mixer = new THREE.AnimationMixer(clone);
      const action = mixer.clipAction(asset.animations[0]);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      playerMixers.push({ mixer, rig });
    }
  }

  /** 用全身球员模型替换几何身体 */
  function applyPlayerModel(rig: PlayerRig): void {
    if (!playerTemplate) return;
    if (rig === qb && qbTemplate) return;
    applyModel(rig, playerTemplate);
  }

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
  }

  // ---- 模式：主页练习（单球员接球） / 模拟比赛（QB+WR+防守） ----
  type Mode = 'practice' | 'game';
  let mode: Mode = 'practice';

  function applyMode(): void {
    // 练习模式也保留 QB（传球目标就在他身上），比赛模式额外上防守球员
    btnGame.querySelector('span')!.textContent = mode === 'game' ? '训练' : '比赛';
  }

  /** 比赛模式：防守球员随机站位并上场，返回站位（供判定用） */
  function spawnDefenders(): Vec2[] {
    for (const d of defenders) scene.remove(d.group);
    defenders.length = 0;
    const positions: Vec2[] = [];
    for (let i = 0; i < DEFENDER_COUNT; i++) {
      const rig = makePlayer(0x8f1a1a, 0x7a4b2c);
      applyHelmet(rig);
      applyPlayerModel(rig);
      const x = Math.round((Math.random() * 22 - 11) * 10) / 10;
      const z = Math.round((3 + Math.random() * 17) * 10) / 10;
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
  const wrSpeed = wrSpeedFor((DEFAULT_WR_CARD.attrs as WRAttrs).SPD);

  function updateHud(): void {
    hudCombo.textContent = String(controller.combo);
    hudAttempts.textContent = String(controller.attempts);
    hudRate.textContent =
      controller.attempts > 0 ? `${Math.round((totalComplete / controller.attempts) * 100)}%` : '—';
  }

  function showBanner(code: string, dynamic: boolean): void {
    resultBanner.className = code === 'complete' ? 'complete' : 'incomplete';
    resultBanner.innerHTML = `${resultHeadline(code as never, dynamic)}<span class="sub">${resultSubline(code as never)}</span>`;
  }

  const controller = new GameController({
    onStateChange: (state) => {
      const idle = state === GameState.PLAY_CALL || state === GameState.RESULT;
      playCall.setEnabled(idle);
      throwHint.classList.toggle('hidden', state !== GameState.ROUTE);
      if (state !== GameState.ROUTE) chargeRing.classList.add('hidden');
      if (idle) playCall.closeCards();
    },
    onSnap: (play) => {
      playCall.setSelected(play.id);
      resultBanner.classList.add('hidden');
    },
    onResult: (result, play) => {
      const duration = routeLength(play.route) / wrSpeed;
      const dynamic = result.code === 'complete' && result.tCatch < duration;
      if (result.code === 'complete') totalComplete += 1;
      showBanner(result.code, dynamic);
      updateHud();
      if (resultTimer) clearTimeout(resultTimer);
      resultTimer = setTimeout(() => controller.nextPlay(), 2200);
    },
  });

  const playCall = renderActionMenu(playcallList, {
    onSelectPlay: (id) => {
      controller.selectPlay(id, mode === 'game' ? spawnDefenders() : undefined);
    },
    onReact: () => {
      const pick = PLAYS[Math.floor(Math.random() * PLAYS.length)];
      controller.selectPlay(pick.id, mode === 'game' ? spawnDefenders() : undefined);
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
    resultBanner.classList.add('hidden');
  });

  // ---- 手势：轻点 = 高球 lob，长按 = 平快球 bullet ----
  attachGesture(canvas, {
    onHoldStart: () => {
      if (controller.state === GameState.ROUTE) chargeRing.classList.remove('hidden');
    },
    onTap: () => {
      chargeRing.classList.add('hidden');
      controller.throwBall('lob');
    },
    onHold: () => {
      chargeRing.classList.add('hidden');
      controller.throwBall('bullet');
    },
    onCancel: () => chargeRing.classList.add('hidden'),
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
    for (const m of playerMixers) m.mixer.update(dt);
    const d = controller.director;
    const moving = !!d && !d.runner.done;

    if (d) {
      wr.group.position.set(d.runner.pos.x, 0, d.runner.pos.z);
      if (moving) {
        wr.group.rotation.y = Math.atan2(d.runner.vel.x, d.runner.vel.z);
        runPhase += dt * 10;
        animateRig(wr, runPhase, true);
      } else {
        idlePhase += dt;
        animateRig(wr, idlePhase * 2, false);
      }
    } else {
      idlePhase += dt;
      animateRig(wr, idlePhase * 2, false);
    }

    // 接入真实球员模型后，用轻微起伏代替骨骼跑动
    wr.modelHolder.position.y = moving ? Math.abs(Math.sin(runPhase)) * 0.06 : 0;
    wr.modelHolder.rotation.z = moving ? Math.sin(runPhase) * 0.03 : 0;

    // QB / 防守球员待机摆动
    idlePhase += dt * 0.5;
    animateRig(qb, idlePhase, false);
    for (let i = 0; i < defenders.length; i++) animateRig(defenders[i], idlePhase + i, false);

    switch (controller.state) {
      case GameState.PLAY_CALL:
      case GameState.SNAP:
      case GameState.ROUTE: {
        const t = performance.now() / 1000;
        if (mode === 'game') {
          ball.position.set(qb.group.position.x, 1.35 + Math.sin(t * 2) * 0.03, qb.group.position.z + 0.3);
        } else {
          ball.position.set(QB_POS.x, 1.35 + Math.sin(t * 2) * 0.03, QB_POS.z + 0.3);
        }
        break;
      }
      case GameState.USER_THROW:
      case GameState.BALL_FLIGHT: {
        if (controller.lastResult) {
          const r = controller.lastResult;
          const traj = computeThrow(QB_POS, r.landing, r.throwType);
          const p = traj.posAt(controller.ballProgress);
          ball.position.set(p.x, 1.4 + traj.heightAt(controller.ballProgress), p.z);
        }
        break;
      }
      case GameState.RESOLVE:
      case GameState.RESULT: {
        if (controller.lastResult) {
          const r = controller.lastResult;
          if (r.code === 'complete' && d) {
            ball.position.set(r.wrPosAtCatch.x, 1.6, r.wrPosAtCatch.z);
          } else {
            ball.position.set(r.landing.x, 0.3, r.landing.z);
          }
        }
        break;
      }
    }
  };
  handle.start();

  // ---- 竖屏提示（不阻断操作，横屏仍是最佳体验）----
  function syncOrientation(): void {
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    if (portrait) rotateHint.classList.remove('hidden');
    else rotateHint.classList.add('hidden');
  }
  syncOrientation();
  window.addEventListener('orientationchange', syncOrientation);
  window.addEventListener('resize', syncOrientation);
  el('rotate-dismiss').addEventListener('click', () => rotateHint.classList.add('hidden'));

  // ---- 设置应用 + 侧边按钮 ----
  const pwa = initPWA({
    onUpdateReady: () => updateToast.classList.remove('hidden'),
    onOfflineReady: () => showToast('✅ 已缓存，可离线游玩'),
  });

  handle.setQuality(loadSettings().quality);
  handle.onQualityChange = (q) => saveSettings({ ...loadSettings(), quality: q });
  bindSideButtons({
    onQualityChange: (q) => handle.setQuality(q),
    onSelectPlay: (id) => controller.selectPlay(id, mode === 'game' ? spawnDefenders() : undefined),
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
  });

  // ---- 更新提示 ----
  el('update-now').addEventListener('click', () => pwa.applyUpdate());
  el('update-later').addEventListener('click', () => updateToast.classList.add('hidden'));

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
