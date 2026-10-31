import { describe, expect, it } from 'vitest';
import { PLAYS, getPlay } from '../data/plays';
import { ROUTES, getRoute, routeLength, routePosAt } from '../gameplay/routes';
import { PlayDirector } from '../gameplay/playDirector';
import { DEFAULT_QB_CARD, DEFAULT_WR_CARD } from '../data/cards';
import type { QBAttrs, WRAttrs } from '../core/types';

const wr = DEFAULT_WR_CARD.attrs as WRAttrs;
const qb = DEFAULT_QB_CARD.attrs as QBAttrs;

describe('战术手册（13 战术：3 跑阵 + 10 传球）', () => {
  it('战术库不变量：共 13 战术，跑阵 3、传球 10，与路线一一对应', () => {
    expect(PLAYS).toHaveLength(13);
    expect(PLAYS.filter((p) => p.kind === 'run')).toHaveLength(3);
    expect(PLAYS.filter((p) => p.kind === 'pass')).toHaveLength(10);
    expect(ROUTES).toHaveLength(13);
    for (const p of PLAYS) {
      expect(() => getRoute(p.route.id)).not.toThrow();
    }
  });

  it('每条路线长度 > 0，插值端点与折线端点一致', () => {
    for (const r of ROUTES) {
      const len = routeLength(r);
      expect(len).toBeGreaterThan(0);
      const start = routePosAt(r, 0).pos;
      const end = routePosAt(r, len).pos;
      expect(start).toEqual(r.points[0]);
      expect(end.x).toBeCloseTo(r.points[r.points.length - 1].x, 6);
      expect(end.z).toBeCloseTo(r.points[r.points.length - 1].z, 6);
    }
  });

  it('球员按新战术路线跑动：Post 中途位置落在折线上', () => {
    const d = new PlayDirector({ play: getPlay('post'), wrAttrs: wr, qbAttrs: qb, rng: () => 0.5 });
    d.advance(0.5);
    // 0.5s × ~8.15yd/s ≈ 4.07yd，仍在第一段直下（z 0→10，x=5）
    expect(d.runner.pos.x).toBeCloseTo(5, 4);
    expect(d.runner.pos.z).toBeGreaterThan(0);
    expect(d.runner.pos.z).toBeLessThan(10);
  });

  it('球员按跑阵战术路线跑动：Dive 从 QB 位（0,-3）起跑', () => {
    const d = new PlayDirector({ play: getPlay('dive'), wrAttrs: wr, qbAttrs: qb, rng: () => 0.5 });
    expect(d.runner.pos).toEqual({ x: 0, z: -3 });
    d.advance(0.4);
    expect(d.runner.pos.x).toBeCloseTo(0, 6);
    expect(d.runner.pos.z).toBeGreaterThan(-3);
  });

  it('新深传路线可完整跑完并判定', () => {
    const d = new PlayDirector({ play: getPlay('corner'), wrAttrs: wr, qbAttrs: qb, rng: () => 0.5 });
    d.advance(d.routeDuration);
    expect(d.runner.done).toBe(true);
    const res = d.attemptThrow('lob');
    expect(['complete', 'defensed', 'overthrow', 'underthrow', 'wide', 'tooLate']).toContain(res.code);
  });
});
