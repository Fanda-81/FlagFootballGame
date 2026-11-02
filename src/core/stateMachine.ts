import { GameState } from './types';
import type { PlayDef, PlayResult, ThrowType, QBAttrs, WRAttrs, Vec2 } from './types';
import { PlayDirector, THROW_WINDOW_AFTER_STOP } from '../gameplay/playDirector';
import { DEFAULT_QB_CARD, DEFAULT_WR_CARD } from '../data/cards';
import { getPlay } from '../data/plays';

export interface ControllerEvents {
  onStateChange?: (state: GameState) => void;
  /** 开球：已选定战术，WR 起跑 */
  onSnap?: (play: PlayDef) => void;
  /** 一档结算 */
  onResult?: (result: PlayResult, play: PlayDef) => void;
}

/**
 * 游戏状态机：选战术 → WR 跑路线 → 玩家传球 → 球飞行 → 结算 → 回到选战术。
 * 纯逻辑（无 DOM / Three.js 依赖），时间由外部时钟驱动。
 */
export class GameController {
  state: GameState = GameState.PLAY_CALL;
  play: PlayDef | null = null;
  director: PlayDirector | null = null;
  attempts = 0;
  combo = 0;
  bestCombo = 0;
  /** 最近一档结果 */
  lastResult: PlayResult | null = null;
  /** 球飞行进度 0..1（渲染用） */
  ballProgress = 0;
  private ballClock = 0;
  private ballTTotal = 0;
  private readonly events: ControllerEvents;
  private readonly wrAttrs: WRAttrs;
  private readonly qbAttrs: QBAttrs;

  constructor(events: ControllerEvents = {}, wrCard = DEFAULT_WR_CARD, qbCard = DEFAULT_QB_CARD) {
    this.events = events;
    this.wrAttrs = wrCard.attrs as WRAttrs;
    this.qbAttrs = qbCard.attrs as QBAttrs;
  }

  /** 复位到开球前（不改变本场统计） */
  reset(): void {
    this.director = null;
    this.play = null;
    this.lastResult = null;
    this.ballProgress = 0;
    this.setState(GameState.PLAY_CALL);
  }

  /** 选择战术并开球（PLAY_CALL / RESULT → ROUTE）；mirror=-1 时左右镜像路线 */
  selectPlay(playId: string, defenders?: Vec2[], mirror: 1 | -1 = 1): void {
    if (this.state !== GameState.PLAY_CALL && this.state !== GameState.RESULT) return;
    const base = getPlay(playId);
    this.play =
      mirror === 1
        ? base
        : {
            ...base,
            route: {
              ...base.route,
              points: base.route.points.map((p) => ({ x: -p.x, z: p.z })),
            },
          };
    this.director = new PlayDirector({
      play: this.play,
      wrAttrs: this.wrAttrs,
      qbAttrs: this.qbAttrs,
      defenders,
    });
    this.lastResult = null;
    this.ballProgress = 0;
    this.setState(GameState.SNAP);
    this.events.onSnap?.(this.play);
    this.setState(GameState.ROUTE);
  }

  /** 玩家出手（ROUTE → BALL_FLIGHT） */
  throwBall(type: ThrowType): void {
    if (this.state !== GameState.ROUTE || !this.director) return;
    this.lastResult = this.director.attemptThrow(type);
    this.ballClock = 0;
    this.ballTTotal = Math.max(this.lastResult.tCatch - this.lastResult.tThrow, 1e-6);
    this.setState(GameState.USER_THROW);
    this.setState(GameState.BALL_FLIGHT);
  }

  /** 时钟推进：WR 跑动 / 球飞行 / 超时结算 */
  update(dt: number): void {
    if (!this.director) return;
    if (this.state === GameState.ROUTE) {
      this.director.advance(dt);
      // WR 跑完且超过宽限窗口仍未出手 → 自动判太晚
      if (
        this.director.runner.done &&
        this.director.t > this.director.routeDuration + THROW_WINDOW_AFTER_STOP
      ) {
        this.lastResult = this.director.attemptThrow('bullet');
        this.settle();
      }
    } else if (this.state === GameState.BALL_FLIGHT) {
      this.ballClock += dt;
      this.ballProgress = Math.min(this.ballClock / this.ballTTotal, 1);
      if (this.ballProgress >= 1) this.settle();
    }
  }

  /** 结算：统计尝试/连击（RESULT） */
  private settle(): void {
    if (!this.play || !this.lastResult) return;
    this.attempts += 1;
    if (this.lastResult.code === 'complete') {
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    } else {
      this.combo = 0;
    }
    this.setState(GameState.RESOLVE);
    this.setState(GameState.RESULT);
    this.events.onResult?.(this.lastResult, this.play);
  }

  /** 结算展示后回到选战术 */
  nextPlay(): void {
    if (this.state !== GameState.RESULT) return;
    this.director = null;
    this.play = null;
    this.lastResult = null;
    this.ballProgress = 0;
    this.setState(GameState.PLAY_CALL);
  }

  private setState(s: GameState): void {
    if (this.state === s) return;
    this.state = s;
    this.events.onStateChange?.(s);
  }
}

/** 结算横幅文案（用户可见文本，与测试逐字一致） */
export function resultHeadline(code: PlayResult['code'], dynamic: boolean): string {
  switch (code) {
    case 'complete':
      return dynamic ? '完美接球！' : '接球完成！';
    case 'drop':
      return '差一点！';
    case 'defensed':
      return '被防守破坏！';
    case 'overthrow':
      return '传大了！';
    case 'underthrow':
      return '传短了！';
    case 'wide':
      return '传偏了！';
    case 'tooLate':
      return '太晚了！';
  }
}

export function resultSubline(code: PlayResult['code']): string {
  switch (code) {
    case 'complete':
      return '连击 +1';
    case 'drop':
      return '球从手里滑掉了，再试一次';
    case 'defensed':
      return '防守球员蹲守落点——换条路线或提前出手';
    case 'overthrow':
      return 'WR 还没跑到——试试平快球或早点出手';
    case 'underthrow':
      return 'WR 跑过了——试试高球打纵深';
    case 'wide':
      return '方向偏了——瞄准 WR 前进路线';
    case 'tooLate':
      return 'WR 已经就位，早点出手！';
  }
}
