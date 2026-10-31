// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachGesture, type GestureResult } from './gestures';

describe('gestures 长按/轻点识别', () => {
  let el: HTMLElement;
  let results: GestureResult[];
  let holdStarts: number;

  beforeEach(() => {
    vi.useFakeTimers();
    el = document.createElement('div');
    document.body.appendChild(el);
    results = [];
    holdStarts = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    el.remove();
  });

  function wire(opts: { holdMs?: number } = {}) {
    attachGesture(el, {
      holdMs: opts.holdMs,
      onTap: (r) => results.push(r),
      onHold: (r) => results.push(r),
      onHoldStart: () => holdStarts++,
    });
  }

  function press() {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
  }
  function release() {
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
  }
  function cancel() {
    el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
  }

  it('反证#1：轻点（249ms）判定 tap，不触发 hold', () => {
    wire();
    press();
    vi.advanceTimersByTime(249);
    release();
    expect(holdStarts).toBe(0);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('tap');
    expect(results[0].duration).toBe(249);
  });

  it('反证#1：长按（250ms 阈值）判定 hold，随后的释放不再触发 tap', () => {
    wire();
    press();
    vi.advanceTimersByTime(250);
    expect(holdStarts).toBe(1);
    release();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('hold');
    expect(results[0].duration).toBe(250);
  });

  it('按住 1 秒后释放：hold 只触发一次，duration 为实际时长', () => {
    wire();
    press();
    vi.advanceTimersByTime(1000);
    release();
    expect(holdStarts).toBe(1);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ type: 'hold', duration: 1000 });
  });

  it('pointercancel 中断：不产生任何回调', () => {
    wire();
    press();
    vi.advanceTimersByTime(100);
    cancel();
    vi.advanceTimersByTime(300);
    expect(holdStarts).toBe(0);
    expect(results).toHaveLength(0);
  });

  it('自定义阈值：600ms 长按 / 599ms 轻点', () => {
    wire({ holdMs: 600 });
    press();
    vi.advanceTimersByTime(599);
    release();
    expect(results[0].type).toBe('tap');

    results.length = 0;
    press();
    vi.advanceTimersByTime(600);
    release();
    expect(results[0].type).toBe('hold');
  });

  it('多指干扰：第二指按下取消第一指手势', () => {
    wire();
    press();
    vi.advanceTimersByTime(100);
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2 }));
    vi.advanceTimersByTime(300);
    release();
    expect(results).toHaveLength(0);
  });
});
