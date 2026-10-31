import type { RouteDef, Vec2 } from '../core/types';

/**
 * 路线树（Route Tree）——MVP 4 条核心路线
 * WR 起跑位于 x=+5（进攻方右侧外接手位），z=0 为开球线。
 */
export const ROUTES: RouteDef[] = [
  {
    id: 'slant',
    name: 'Slant 斜插',
    points: [
      { x: 5, z: 0 },
      { x: 5, z: 3 },
      { x: 0, z: 8 },
    ],
  },
  {
    id: 'hitch',
    name: 'Hitch 急停',
    points: [
      { x: 5, z: 0 },
      { x: 5, z: 6 },
    ],
  },
  {
    id: 'out',
    name: 'Out 外切',
    points: [
      { x: 5, z: 0 },
      { x: 5, z: 8 },
      { x: 12, z: 8 },
    ],
  },
  {
    id: 'go',
    name: 'Go 直下',
    points: [
      { x: 5, z: 0 },
      { x: 5, z: 40 },
    ],
  },
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
