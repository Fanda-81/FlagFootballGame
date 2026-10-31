import type { RouteDef, Vec2 } from '../core/types';

/**
 * 路线树（Route Tree）——腰旗橄榄球战术手册 13 条路线
 * 传球路线 WR 起跑 x=+5（右侧外接手位）；跑阵路线 QB 起跑 (0,-3)。
 */
export const ROUTES: RouteDef[] = [
  // ---- 传球路线（Pass，10）----
  { id: 'slant', name: 'Slant 斜插', points: [{ x: 5, z: 0 }, { x: 5, z: 3 }, { x: 0, z: 8 }] },
  { id: 'hitch', name: 'Hitch 急停', points: [{ x: 5, z: 0 }, { x: 5, z: 6 }] },
  { id: 'out', name: 'Out 外切', points: [{ x: 5, z: 0 }, { x: 5, z: 8 }, { x: 12, z: 8 }] },
  { id: 'go', name: 'Go 直下', points: [{ x: 5, z: 0 }, { x: 5, z: 40 }] },
  { id: 'post', name: 'Post 内切深区', points: [{ x: 5, z: 0 }, { x: 5, z: 10 }, { x: 0, z: 20 }] },
  { id: 'corner', name: 'Corner 角旗', points: [{ x: 5, z: 0 }, { x: 5, z: 10 }, { x: 12, z: 18 }] },
  { id: 'curl', name: 'Curl 回身内钩', points: [{ x: 5, z: 0 }, { x: 5, z: 12 }, { x: 2.5, z: 14.5 }] },
  { id: 'comeback', name: 'Comeback 回身外钩', points: [{ x: 5, z: 0 }, { x: 5, z: 14 }, { x: 9, z: 12 }] },
  { id: 'drag', name: 'Drag 横穿', points: [{ x: 5, z: 0 }, { x: 5, z: 3 }, { x: -6, z: 6 }] },
  { id: 'fade', name: 'Fade 纵深漂移', points: [{ x: 5, z: 0 }, { x: 9, z: 28 }] },
  // ---- 跑阵路线（Run，3）----
  { id: 'dive', name: 'Dive 中路直冲', points: [{ x: 0, z: -3 }, { x: 0, z: 6 }] },
  { id: 'sweep', name: 'Sweep 外侧横扫', points: [{ x: 0, z: -3 }, { x: 9, z: 2 }, { x: 13, z: 9 }] },
  { id: 'reverse', name: 'Reverse 反向跑', points: [{ x: 0, z: -3 }, { x: -9, z: 2 }, { x: -13, z: 9 }] },
];

export function getRoute(id: string): RouteDef {
  const r = ROUTES.find((route) => route.id === id);
  if (!r) throw new Error(`未知路线: ${id}`);
  return r;
}

/** 折线总长度（yd） */
export function routeLength(route: RouteDef): number {
  let len = 0;
  for (let i = 1; i < route.points.length; i++) {
    len += segLen(route.points[i - 1], route.points[i]);
  }
  return len;
}

/** 沿折线弧长 s 处的位置与前进方向（s 超出范围时夹到端点） */
export function routePosAt(route: RouteDef, s: number): { pos: Vec2; dir: Vec2 } {
  const clamped = Math.max(0, Math.min(s, routeLength(route)));
  let remaining = clamped;
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1];
    const b = route.points[i];
    const len = segLen(a, b);
    if (remaining <= len || i === route.points.length - 1) {
      const t = len > 0 ? remaining / len : 1;
      const dir = len > 0 ? norm(sub(b, a)) : { x: 0, z: 1 };
      return {
        pos: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t },
        dir,
      };
    }
    remaining -= len;
  }
  // 不可达：路线为空
  return { pos: route.points[0] ?? { x: 0, z: 0 }, dir: { x: 0, z: 1 } };
}

function segLen(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, z: a.z - b.z };
}

function norm(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / len, z: v.z / len };
}
