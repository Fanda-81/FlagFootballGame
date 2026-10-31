import type { PlayResultCode, Vec2 } from '../core/types';

/** 基础接球容差半径（码）；CTH=80 时恰好等于该值 */
export const BASE_CATCH_RADIUS = 1.8;

/**
 * 接球容差半径：CTH 越高范围越大（0.8x ~ 1.2x）
 * CTH=0 → 1.45yd；CTH=80 → 1.8yd；CTH=99 → 2.15yd
 */
export function catchRadiusFor(cth: number): number {
  return BASE_CATCH_RADIUS * (1 + (cth - 80) / 99);
}

export interface CatchVerdict {
  code: PlayResultCode;
  distance: number;
  catchRadius: number;
}

/**
 * 接球判定：球落点 vs 球到达时 WR 的实际位置（2D 水平面）。
 * - 距离 ≤ 容差 → complete
 * - 球落点更深（z 更大）→ overthrow 传大了
 * - 球落点更浅（z 更小）→ underthrow 传短了
 * - 横向偏差主导 → wide 偏了
 */
export function judgeCatch(landing: Vec2, wrPos: Vec2, cth: number): CatchVerdict {
  const radius = catchRadiusFor(cth);
  const distance = Math.hypot(landing.x - wrPos.x, landing.z - wrPos.z);
  if (distance <= radius) return { code: 'complete', distance, catchRadius: radius };

  const dz = landing.z - wrPos.z;
  const dx = Math.abs(landing.x - wrPos.x);
  if (dz > radius) return { code: 'overthrow', distance, catchRadius: radius };
  if (dz < -radius) return { code: 'underthrow', distance, catchRadius: radius };
  if (dx > radius) return { code: 'wide', distance, catchRadius: radius };
  // 边界兜底：未落入任何方向桶（极少见）
  return { code: 'wide', distance, catchRadius: radius };
}
