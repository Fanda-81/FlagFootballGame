import { describe, expect, it } from 'vitest';
import { getRoute, routeLength, routePosAt } from './routes';

describe('routes', () => {
  it('slant 折线总长 = 3 + 5√2', () => {
    const slant = getRoute('slant');
    expect(routeLength(slant)).toBeCloseTo(3 + 5 * Math.SQRT2, 6);
  });

  it('插值在起点/终点与折线端点一致', () => {
    const slant = getRoute('slant');
    const total = routeLength(slant);
    expect(routePosAt(slant, 0).pos).toEqual({ x: 5, z: 0 });
    expect(routePosAt(slant, total).pos.x).toBeCloseTo(0, 6);
    expect(routePosAt(slant, total).pos.z).toBeCloseTo(8, 6);
  });

  it('越界弧长夹到端点', () => {
    const go = getRoute('go');
    const total = routeLength(go);
    const over = routePosAt(go, total + 100);
    expect(over.pos.z).toBeCloseTo(40, 6);
  });

  it('go 直下路线方向始终 +z', () => {
    const go = getRoute('go');
    const mid = routePosAt(go, 20);
    expect(mid.pos).toEqual({ x: 5, z: 20 });
    expect(mid.dir).toEqual({ x: 0, z: 1 });
  });

  it('未知路线抛错（fail-closed）', () => {
    expect(() => getRoute('nope')).toThrow('未知路线');
  });
});
