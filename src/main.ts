import './style.css';
import * as THREE from 'three';
import { animateRig, buildScene, makePlayer, type PlayerRig } from './three/scene';
import { loadHelmet, loadStadium } from './three/stadium';
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
import { loadSettings } from './data/storage';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`找不到 #${id}`);
  return node as T;
}

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

// ---- 场景与渲染 ----
const { scene, qb, wr, ball, stands } = buildScene();
const cameraRig = createCamera();
const handle = createRenderer(canvas, scene, cameraRig.camera);
attachZoom(canvas, cameraRig); // 滚轮 / 双指捏合缩放

// ---- 外部模型：真实头盔 + 环形体育场（失败静默回退几何体） ----
let helmetTemplate: THREE.Object3D | null = null;

/** 用真实头盔模型替换球员几何头 */
function applyHelmet(rig: PlayerRig): void {
  if (!helmetTemplate) return;
  for (const child of Array.from(rig.headAnchor.children)) rig.headAnchor.remove(child);
  const clone = helmetTemplate.clone(true);
  clone.position.set(0, 0, 0);
  rig.headAnchor.add(clone);
}

void loadHelmet().then((template) => {
  if (!template) return;
  helmetTemplate = template;
  for (const rig of [qb, wr, ...defenders]) applyHelmet(rig);
});
void loadStadium(scene).then((stadium) => {
  if (stadium) stands.visible = false; // 模型自带看台，隐藏几何人群
});

// ---- 模式：主页练习（单球员接球） / 模拟比赛（QB+WR+防守） ----
type Mode = 'practice' | 'game';
let mode: Mode = 'practice';
const defenders: PlayerRig[] = [];
const DEFENDER_COUNT = 4;

function applyMode(): void {
  // 主页练习模式：场上只有一个接球球员（WR），QB 隐藏
  qb.group.visible = mode === 'game';
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
    const x = Math.round((Math.random() * 22 - 11) * 10) / 10; // -11 ~ 11
    const z = Math.round((3 + Math.random() * 17) * 10) / 10; // 3 ~ 20
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
  hudRate.textContent = controller.attempts > 0 ? `${Math.round((totalComplete / controller.attempts) * 100)}%` : '—';
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

handle.onFrame = (dt) => {
  controller.update(dt);
  const d = controller.director;

  if (d) {
    // WR：位置 + 朝向 + 跑动动画
    wr.group.position.set(d.runner.pos.x, 0, d.runner.pos.z);
    if (!d.runner.done) {
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
        // 练习模式：球在底线 QB 虚拟手中
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

// ---- 竖屏提示 ----
function syncOrientation(): void {
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  rotateHint.classList.toggle('hidden', !portrait);
}
syncOrientation();
window.addEventListener('orientationchange', syncOrientation);
window.addEventListener('resize', syncOrientation);

// ---- 设置应用 + 侧边按钮 ----
handle.setQuality(loadSettings().quality);
bindSideButtons({
  onQualityChange: (q) => handle.setQuality(q),
  onSelectPlay: (id) => controller.selectPlay(id, mode === 'game' ? spawnDefenders() : undefined),
});
