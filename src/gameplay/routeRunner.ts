import type { RouteDef, Vec2 } from '../core/types';
import { routeLength, routePosAt } from './routes';

/**
 * WR 沿路线匀速推进的纯数据状态（无渲染依赖）。
 */
export interface RunnerState {
  /** 已跑弧长（yd） */
  s: number;
  pos: Vec2;
  /** 当前速度向量（yd/s），跑完为 0 */
  vel: Vec2;
  done: boolean;
}

/** WR 速度（yd/s）：SPD 0→6，99→8.5 */
export function wrSpeedFor(spd: number): number {
  return 6 + (spd / 99) * 2.5;
}

export function makeRunner(route: RouteDef, speedYps: number): RunnerState {
  const start = routePosAt(route, 0);
  return {
    s: 0,
    pos: { ...start.pos },
    vel: { x: start.dir.x * speedYps, z: start.dir.z * speedYps },
    done: false,
  };
}

/** 推进 dt 秒，返回新状态（不可变） */
export function advanceRunner(state: RunnerState, route: RouteDef, speedYps: number, dt: number): RunnerState {
  if (state.done) return { ...state, vel: { x: 0, z: 0 } };
  const total = routeLength(route);
  const s2 = Math.min(state.s + speedYps * dt, total);
  const { pos, dir } = routePosAt(route, s2);
  const done = s2 >= total;
  const speed = done ? 0 : speedYps;
  return {
    s: s2,
    pos,
    vel: done ? { x: 0, z: 0 } : { x: dir.x * speed, z: dir.z * speed },
    done,
  };
}
