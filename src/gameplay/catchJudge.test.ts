import { describe, expect, it } from 'vitest';
import { BASE_CATCH_RADIUS, catchRadiusFor, judgeCatch } from './catchJudge';

describe('catchJudge', () => {
  it('反证#3：CTH=80 时容差边界正确翻转（1.79 完成 / 1.81 未完成）', () => {
    expect(catchRadiusFor(80)).toBeCloseTo(BASE_CATCH_RADIUS, 6);
    const near = judgeCatch({ x: 1.79, z: 0 }, { x: 0, z: 0 }, 80);
    expect(near.code).toBe('complete');
    const far = judgeCatch({ x: 1.81, z: 0 }, { x: 0, z: 0 }, 80);
    expect(far.code).not.toBe('complete');
  });

  it('CTH 越高容差越大', () => {
    expect(catchRadiusFor(99)).toBeGreaterThan(catchRadiusFor(60));
  });

  it('方向分类：传大 / 传短 / 偏出', () => {
    const wr = { x: 0, z: 5 };
    // 落点更深（z 更大）= 传大了
    expect(judgeCatch({ x: 0, z: 10 }, wr, 80).code).toBe('overthrow');
    // 落点更浅 = 传短了
    expect(judgeCatch({ x: 0, z: 0 }, wr, 80).code).toBe('underthrow');
    // 横向偏差 = 偏了
    expect(judgeCatch({ x: 5, z: 5 }, wr, 80).code).toBe('wide');
  });

  it('命中即 complete', () => {
    const v = judgeCatch({ x: 0.5, z: 0.2 }, { x: 0, z: 0 }, 80);
    expect(v.code).toBe('complete');
    expect(v.distance).toBeCloseTo(Math.hypot(0.5, 0.2), 6);
  });
});
