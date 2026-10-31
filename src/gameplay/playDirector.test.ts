import { describe, expect, it } from 'vitest';
import { DEFAULT_QB_CARD, DEFAULT_WR_CARD } from '../data/cards';
import { getPlay } from '../data/plays';
import type { QBAttrs, WRAttrs } from '../core/types';
import { PlayDirector, QB_POS, THROW_WINDOW_AFTER_STOP } from './playDirector';

const wr = DEFAULT_WR_CARD.attrs as WRAttrs;
const qb = DEFAULT_QB_CARD.attrs as QBAttrs;
// 确定性 rng：rng()=0.5 → noise=0
const fixedRng = () => 0.5;

function make(playId: string, rng: () => number = fixedRng): PlayDirector {
  return new PlayDirector({ play: getPlay(playId), wrAttrs: wr, qbAttrs: qb, rng });
}

describe('playDirector', () => {
  it('构造时 WR 位于路线起点，QB 位于开球线后 3 码', () => {
    const d = make('slant');
    expect(d.runner.pos).toEqual({ x: 5, z: 0 });
    expect(QB_POS).toEqual({ x: 0, z: -3 });
  });

  it('advance 推进 WR 沿路线移动', () => {
    const d = make('go');
    d.advance(0.5);
    expect(d.runner.pos.x).toBeCloseTo(5, 6);
    expect(d.runner.pos.z).toBeGreaterThan(0);
  });

  it('反证#4 前置：slant 段 2 直线段出手 bullet → 精确命中（lead=1.0）', () => {
    const d = make('slant');
    d.advance(0.7); // WR 已过拐点进入斜插段
    const res = d.attemptThrow('bullet');
    expect(res.code).toBe('complete');
    expect(res.distance).toBeLessThan(0.05);
  });

  it('Out 路线 90° 拐点前用 lob 出手 → 球沿旧方向飞过 → 传大（overthrow）', () => {
    const d = make('out');
    d.advance(0.9); // 仍在外切前的直下段（拐点在 z=8，约 t=0.98s）
    const res = d.attemptThrow('lob');
    expect(res.code).toBe('overthrow');
  });

  it('同场景用 bullet（推荐球型）→ 球快，拐点穿越偏差小于容差 → 完成', () => {
    const d = make('out');
    d.advance(0.9);
    const res = d.attemptThrow('bullet');
    expect(res.code).toBe('complete');
  });

  it('WR 跑完后停留窗口内出手 → 命中静止目标', () => {
    const d = make('hitch');
    d.advance(d.routeDuration + 0.4); // 已停，但未超宽限窗口
    const res = d.attemptThrow('bullet');
    expect(res.code).toBe('complete');
  });

  it('WR 跑完后超过宽限窗口出手 → tooLate', () => {
    const d = make('hitch');
    d.advance(d.routeDuration + THROW_WINDOW_AFTER_STOP + 0.2);
    const res = d.attemptThrow('bullet');
    expect(res.code).toBe('tooLate');
  });

  it('lob 飞行时间更长（同距离下手）', () => {
    const d1 = make('go');
    d1.advance(0.5);
    const bullet = d1.attemptThrow('bullet');
    const d2 = make('go');
    d2.advance(0.5);
    const lob = d2.attemptThrow('lob');
    expect(lob.tCatch - lob.tThrow).toBeGreaterThan(bullet.tCatch - bullet.tThrow);
  });
});
