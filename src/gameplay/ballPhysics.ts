import type { QBAttrs, ThrowType, Vec2 } from '../core/types';

/** 球速（码/秒） */
export const BALL_SPEED: Record<ThrowType, number> = {
  bullet: 45,
  lob: 26,
};

/** 弧线顶点高度（米） */
export const APEX_M: Record<ThrowType, number> = {
  bullet: 1.5,
  lob: 4.5,
};

/** QB 卡影响球速的系数：THP 0→0.9，99→1.1 */
export function qbSpeedFactor(qbCard?: QBAttrs): number {
  if (!qbCard) return 1.0;
  return 0.9 + 0.2 * (qbCard.THP / 99);
}

export interface BallTrajectory {
  throwType: ThrowType;
  /** 出手点（QB 位置） */
  origin: Vec2;
  /** 落点 */
  landing: Vec2;
  /** 飞行时间（秒） */
  tFlight: number;
  /** 有效球速（yd/s，含 QB 系数） */
  speed: number;
  /** 归一化进度 0..1 → 球水平位置 */
  posAt(t01: number): Vec2;
  /** 归一化进度 0..1 → 球离地高度（米） */
  heightAt(t01: number): number;
}

/**
 * 计算一次传球的轨迹与落点。
 * 落点 = 目标点（调用方负责 lead 计算）。
 */
export function computeThrow(
  origin: Vec2,
  target: Vec2,
  type: ThrowType,
  qbCard?: QBAttrs,
): BallTrajectory {
  const speed = BALL_SPEED[type] * qbSpeedFactor(qbCard);
  const dist = Math.hypot(target.x - origin.x, target.z - origin.z);
  const tFlight = dist / speed;
  const apex = APEX_M[type];
  const clamped01 = (v: number) => Math.max(0, Math.min(1, v));
  return {
    throwType: type,
    origin,
    landing: target,
    tFlight,
    speed,
    posAt: (t01) => {
      const t = clamped01(t01);
      return { x: origin.x + (target.x - origin.x) * t, z: origin.z + (target.z - origin.z) * t };
    },
    heightAt: (t01) => 4 * clamped01(t01) * (1 - clamped01(t01)) * apex,
  };
}
