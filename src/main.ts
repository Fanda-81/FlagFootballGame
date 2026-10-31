import './style.css';
import { buildScene } from './three/scene';
import { createCamera } from './three/camera';
import { createRenderer } from './three/renderer';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('找不到 #game-canvas');

// Wave 2 骨架：静态球场 + QB/WR + 球
const { scene, qb, wr, ball } = buildScene();
const camera = createCamera();
const handle = createRenderer(canvas, scene, camera);

// 球的微动画：绕 QB 手部轻微浮动（Wave 3 由游戏状态接管）
let ballT = 0;
handle.onFrame = (dt) => {
  ballT += dt;
  ball.position.set(qb.position.x, 1.4 + Math.sin(ballT * 2) * 0.04, qb.position.z + 0.3);
};

handle.start();
void wr;
