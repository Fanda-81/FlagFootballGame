import './style.css';
import { buildScene } from './three/scene';
import { createCamera } from './three/camera';
import { createRenderer } from './three/renderer';
import { GameController, resultHeadline, resultSubline } from './core/stateMachine';
import { GameState } from './core/types';
import type { WRAttrs } from './core/types';
import { QB_POS } from './gameplay/playDirector';
import { computeThrow } from './gameplay/ballPhysics';
import { routeLength } from './gameplay/routes';
import { wrSpeedFor } from './gameplay/routeRunner';
import { DEFAULT_WR_CARD } from './data/cards';
import { attachGesture } from './ui/gestures';
import { renderPlayCall } from './ui/playCall';

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

// ---- 场景与渲染 ----
const { scene, qb, wr, ball } = buildScene();
const camera = createCamera();
const handle = createRenderer(canvas, scene, camera);

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

const playCall = renderPlayCall(playcallList, (id) => controller.selectPlay(id));
playCall.setEnabled(true);
updateHud();

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
handle.onFrame = (dt) => {
  controller.update(dt);
  const d = controller.director;

  if (d) {
    // WR：位置 + 朝向（沿速度方向）
    wr.position.set(d.runner.pos.x, 0, d.runner.pos.z);
    if (!d.runner.done) {
      wr.rotation.y = Math.atan2(d.runner.vel.x, d.runner.vel.z);
    }
  }

  switch (controller.state) {
    case GameState.PLAY_CALL:
    case GameState.SNAP:
    case GameState.ROUTE: {
      // QB 持球待机（微呼吸）
      const t = performance.now() / 1000;
      ball.position.set(qb.position.x, 1.35 + Math.sin(t * 2) * 0.03, qb.position.z + 0.3);
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
