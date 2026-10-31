/**
 * Pointer 手势识别：轻点（tap = 高球 lob）vs 长按（hold = 平快球 bullet）。
 * - 阈值默认 250ms；按住达到阈值瞬间触发 onHoldStart（蓄力环反馈）
 * - 释放时：未达阈值 → onTap；已达阈值 → onHold（duration 为实际按住时长）
 * - pointercancel / 多指干扰 → 静默取消，不产生回调
 * 支持 touch + mouse（Pointer Events 统一）。
 */

export interface GestureResult {
  type: 'tap' | 'hold';
  /** 实际按住时长（ms） */
  duration: number;
}

export interface GestureOptions {
  /** 长按阈值（ms），默认 250 */
  holdMs?: number;
  onTap?: (r: GestureResult) => void;
  onHold?: (r: GestureResult) => void;
  /** 达到长按阈值瞬间（用于蓄力视觉反馈） */
  onHoldStart?: () => void;
  onCancel?: () => void;
}

export function attachGesture(el: HTMLElement, opts: GestureOptions): () => void {
  const holdMs = opts.holdMs ?? 250;
  let activePointerId: number | null = null;
  let t0 = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let thresholdPassed = false;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const reset = () => {
    clear();
    activePointerId = null;
    thresholdPassed = false;
  };

  const onPointerDown = (e: PointerEvent) => {
    // 多指干扰：已有活动手势时，新按下取消当前手势且不开始新手势
    if (activePointerId !== null) {
      reset();
      opts.onCancel?.();
      return;
    }
    activePointerId = e.pointerId;
    t0 = Date.now();
    thresholdPassed = false;
    timer = setTimeout(() => {
      thresholdPassed = true;
      timer = null;
      opts.onHoldStart?.();
    }, holdMs);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    const duration = Date.now() - t0;
    clear();
    activePointerId = null;
    if (thresholdPassed) {
      opts.onHold?.({ type: 'hold', duration });
    } else {
      opts.onTap?.({ type: 'tap', duration });
    }
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    reset();
    opts.onCancel?.();
  };

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerCancel);

  return () => {
    reset();
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerCancel);
  };
}
