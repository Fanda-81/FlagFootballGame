import type { PlayDef, PlayResult, QBAttrs, ThrowType, Vec2, WRAttrs } from '../core/types';
import { BALL_SPEED, qbSpeedFactor } from './ballPhysics';
import { judgeCatch } from './catchJudge';
import { routeLength } from './routes';
import { advanceRunner, makeRunner, type RunnerState, wrSpeedFor } from './routeRunner';

/** QB 固定站位：开球线后 3 码 */
export const QB_POS: Vec2 = { x: 0, z: -3 };

/** WR 跑完路线后玩家仍可出手的宽限窗口（秒），超时判定 tooLate */
export const THROW_WINDOW_AFTER_STOP = 0.7;

/** QB 精度噪声幅度（码），TAC=99 时为零（确定性） */
const TAC_NOISE_YD = 1.5;

/** 防守破坏半径：球落点距防守球员小于该值时，接球被破坏 */
export const DEFEND_RADIUS = 2.0;

export interface PlayContext {
  play: PlayDef;
  wrAttrs: WRAttrs;
  qbAttrs: QBAttrs;
  /** 可注入随机源（测试确定性）；缺省 Math.random */
  rng?: () => number;
  /** 比赛模式：防守球员站位（练习模式缺省 = 无防守） */
  defenders?: Vec2[];
}

/**
 * 一档 play 的纯逻辑编排（无渲染依赖，集成测试目标）。
 * 时间轴：t=0 起 WR 沿路线起跑；玩家任意时刻 attemptThrow。
 * lead=1.0：落点 = 出手瞬间 WR 速度向量外推飞行时间。
 * 直线匀速段上该式精确命中；拐点转向/停跑会产生自然偏差 → 玩家需掐时机。
 */
export class PlayDirector {
  readonly play: PlayDef;
  readonly wrAttrs: WRAttrs;
  readonly qbAttrs: QBAttrs;
  readonly wrSpeed: number;
  /** play 内相对时间（秒） */
  t = 0;
  runner: RunnerState;
  private readonly rng: () => number;
  private readonly defenders: Vec2[];

  constructor(ctx: PlayContext) {
    this.play = ctx.play;
    this.wrAttrs = ctx.wrAttrs;
    this.qbAttrs = ctx.qbAttrs;
    this.rng = ctx.rng ?? Math.random;
    this.defenders = ctx.defenders ?? [];
    this.wrSpeed = wrSpeedFor(ctx.wrAttrs.SPD);
    this.runner = makeRunner(ctx.play.route, this.wrSpeed);
  }

  /** WR 跑完全程所需时间（秒） */
  get routeDuration(): number {
    return routeLength(this.play.route) / this.wrSpeed;
  }

  /** 推进 play 时间（WR 跑动） */
  advance(dt: number): void {
    this.t += dt;
    this.runner = advanceRunner(this.runner, this.play.route, this.wrSpeed, dt);
  }

  /**
   * 出手：锁定落点（lead + 精度噪声）→ 在副本上模拟 WR 到球到达时刻 → 判定。
   */
  attemptThrow(type: ThrowType): PlayResult {
    const tThrow = this.t;
    const base: Omit<PlayResult, 'code' | 'distance' | 'catchRadius'> = {
      throwType: type,
      landing: { ...this.runner.pos },
      wrPosAtCatch: { ...this.runner.pos },
      tThrow,
      tCatch: tThrow,
    };

    if (this.runner.done && tThrow > this.routeDuration + THROW_WINDOW_AFTER_STOP) {
      return { ...base, code: 'tooLate', distance: 0, catchRadius: 0 };
    }

    // 1) lead 落点：按出手瞬间 WR 速度外推飞行时间
    const speed = BALL_SPEED[type] * qbSpeedFactor(this.qbAttrs);
    const estDist = Math.hypot(this.runner.pos.x - QB_POS.x, this.runner.pos.z - QB_POS.z);
    const tFlight = estDist / speed;
    let landing: Vec2 = {
      x: this.runner.pos.x + this.runner.vel.x * tFlight,
      z: this.runner.pos.z + this.runner.vel.z * tFlight,
    };

    // 2) QB 精度噪声（TAC=99 → 0）
    const noiseScale = TAC_NOISE_YD * (1 - this.qbAttrs.TAC / 99);
    const noise = () => (this.rng() * 2 - 1) * noiseScale;
    landing = { x: landing.x + noise(), z: landing.z + noise() };

    // 3) 在副本上模拟 WR 跑动到球到达时刻
    const tCatch = tThrow + tFlight;
    let wr = this.runner;
    for (let t = tThrow; t < tCatch; ) {
      const step = Math.min(1 / 60, tCatch - t);
      wr = advanceRunner(wr, this.play.route, this.wrSpeed, step);
      t += step;
    }

    const verdict = judgeCatch(landing, wr.pos, this.wrAttrs.CTH);
    let code = verdict.code;
    // 比赛模式：防守球员蹲守落点附近 → 接球被破坏
    if (code === 'complete' && this.defenders.some((d) => Math.hypot(d.x - landing.x, d.z - landing.z) < DEFEND_RADIUS)) {
      code = 'defensed';
    }
    return {
      ...base,
      code,
      landing,
      wrPosAtCatch: { ...wr.pos },
      distance: verdict.distance,
      catchRadius: verdict.catchRadius,
      tCatch,
    };
  }
}
