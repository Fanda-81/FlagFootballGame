import { describe, expect, it } from 'vitest';
import { GameController, resultHeadline } from '../core/stateMachine';
import { GameState } from '../core/types';

/**
 * 集成测试：真实数据（战术库 + 卡牌）+ 状态机 + PlayDirector 全链路，
 * 不 mock 任何中间层（时间由 update(dt) 外部时钟驱动）。
 */

describe('play 全链路集成（不 mock 中间层）', () => {
  it('反证#4：推荐球型 + 正确时机 = 完整一档完成（bullet 打 slant）', () => {
    const c = new GameController();
    expect(c.state).toBe(GameState.PLAY_CALL);

    c.selectPlay('slant');
    c.snap();
    expect(c.state).toBe(GameState.ROUTE);

    // WR 起跑 0.7s 后出手（已进入斜插段，推荐 bullet）
    c.update(0.7);
    c.throwBall('bullet');
    expect(c.state).toBe(GameState.BALL_FLIGHT);

    // 推进到球到达（tFlight ≈ 0.14s）
    c.update(0.2);
    expect(c.state).toBe(GameState.RESULT);
    expect(c.lastResult?.code).toBe('complete');
    expect(c.attempts).toBe(1);
    expect(c.combo).toBe(1);

    c.nextPlay();
    expect(c.state).toBe(GameState.PLAY_CALL);
  });

  it('错误球型：Out 拐点前用 lob → 传大 → 连击清零', () => {
    const c = new GameController();
    c.selectPlay('out');
    c.snap();
    c.update(0.9);
    c.throwBall('lob');
    c.update(0.6);
    expect(c.state).toBe(GameState.RESULT);
    expect(c.lastResult?.code).toBe('overthrow');
    expect(c.combo).toBe(0);
    expect(c.attempts).toBe(1);
  });

  it('超时：WR 跑完且超过宽限窗口未出手 → 自动 tooLate 结算', () => {
    const c = new GameController();
    c.selectPlay('hitch');
    c.snap();
    // hitch 全程约 0.74s，宽限 0.7s；推进 1.6s 必然超时
    c.update(1.6);
    expect(c.state).toBe(GameState.RESULT);
    expect(c.lastResult?.code).toBe('tooLate');
    expect(c.combo).toBe(0);
  });

  it('连击累计：连续两次完成 combo=2', () => {
    const c = new GameController();
    c.selectPlay('hitch');
    c.snap();
    c.update(0.5); // WR 已急停
    c.throwBall('bullet');
    c.update(0.3);
    expect(c.lastResult?.code).toBe('complete');

    c.nextPlay();
    c.selectPlay('hitch');
    c.snap();
    c.update(0.5);
    c.throwBall('bullet');
    c.update(0.3);
    expect(c.lastResult?.code).toBe('complete');
    expect(c.attempts).toBe(2);
    expect(c.combo).toBe(2);
    expect(c.bestCombo).toBe(2);
  });

  it('状态守卫：非 ROUTE 状态出手无效；非 PLAY_CALL/RESULT 选战术无效', () => {
    const c = new GameController();
    c.throwBall('bullet'); // PLAY_CALL 下出手 → 无效果
    expect(c.state).toBe(GameState.PLAY_CALL);
    expect(c.lastResult).toBeNull();

    c.selectPlay('go');
    c.snap();
    c.selectPlay('slant'); // ROUTE 下不可重选
    expect(c.play?.id).toBe('go');
  });

  it('结算文案逐字正确', () => {
    expect(resultHeadline('complete', true)).toBe('完美接球！');
    expect(resultHeadline('complete', false)).toBe('接球完成！');
    expect(resultHeadline('overthrow', false)).toBe('传大了！');
    expect(resultHeadline('underthrow', false)).toBe('传短了！');
    expect(resultHeadline('wide', false)).toBe('传偏了！');
    expect(resultHeadline('tooLate', false)).toBe('太晚了！');
  });
});
