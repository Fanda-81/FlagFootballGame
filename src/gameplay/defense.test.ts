import { describe, expect, it } from 'vitest';
import { DEFAULT_QB_CARD, DEFAULT_WR_CARD } from '../data/cards';
import { getPlay } from '../data/plays';
import type { QBAttrs, WRAttrs } from '../core/types';
import { PlayDirector, DEFEND_RADIUS } from './playDirector';

const wr = DEFAULT_WR_CARD.attrs as WRAttrs;
const qb = DEFAULT_QB_CARD.attrs as QBAttrs;
const fixedRng = () => 0.5;

function make(playId: string, defenders?: { x: number; z: number }[]) {
  return new PlayDirector({
    play: getPlay(playId),
    wrAttrs: wr,
    qbAttrs: qb,
    rng: fixedRng,
    defenders,
  });
}

describe('playDirector 防守判定', () => {
  it('无防守球员：slant 正常完成（行为不回归）', () => {
    const d = make('slant');
    d.advance(0.7);
    expect(d.attemptThrow('bullet').code).toBe('complete');
  });

  it('防守球员蹲守在落点附近 → 被破坏（defensed）', () => {
    // 先算一次无防守的落点，再让防守者站在落点旁
    const probe = make('slant');
    probe.advance(0.7);
    const expected = probe.attemptThrow('bullet');
    expect(expected.code).toBe('complete');

    const d = make('slant', [{ x: expected.landing.x + 1.2, z: expected.landing.z }]);
    d.advance(0.7);
    const res = d.attemptThrow('bullet');
    expect(res.code).toBe('defensed');
  });

  it('防守球员远离落点（> DEFEND_RADIUS）→ 不受影响', () => {
    const d = make('slant', [{ x: -10, z: 30 }]);
    d.advance(0.7);
    expect(d.attemptThrow('bullet').code).toBe('complete');
    expect(DEFEND_RADIUS).toBeGreaterThan(0);
  });
});
