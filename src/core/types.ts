/**
 * 共享类型与游戏状态定义
 * 坐标系：x 横向（-13.35 ~ +13.35 yd，0 为球场中线），z 纵深（0 = 开球线 LOS，正方向深入对方端区）
 * 单位：码（yd）
 */

export enum GameState {
  /** 选择战术 */
  PLAY_CALL = 'PLAY_CALL',
  /** 开球瞬间 */
  SNAP = 'SNAP',
  /** WR 沿路线跑动，等待玩家传球 */
  ROUTE = 'ROUTE',
  /** 玩家已出手 */
  USER_THROW = 'USER_THROW',
  /** 球飞行中 */
  BALL_FLIGHT = 'BALL_FLIGHT',
  /** 接球判定完成 */
  RESOLVE = 'RESOLVE',
  /** 结算展示 */
  RESULT = 'RESULT',
}

/** 球型：轻点=高球 lob，长按=平快球 bullet */
export type ThrowType = 'bullet' | 'lob';

export interface Vec2 {
  x: number;
  z: number;
}

// ---- 球员卡 ----

/** 外接手属性 */
export interface WRAttrs {
  /** 速度 SPD */
  SPD: number;
  /** 接球 CTH */
  CTH: number;
  /** 路线跑动 RTE */
  RTE: number;
  /** 敏捷 AGI */
  AGI: number;
}

/** 四分卫属性 */
export interface QBAttrs {
  /** 传球力量 THP */
  THP: number;
  /** 传球精度 TAC */
  TAC: number;
  /** 速度 SPD */
  SPD: number;
  /** 意识 AWR */
  AWR: number;
}

export type CardRarity = 'common' | 'rare' | 'epic';

export interface PlayerCard {
  id: string;
  name: string;
  position: 'QB' | 'WR';
  attrs: WRAttrs | QBAttrs;
  rarity: CardRarity;
}

// ---- 战术 ----

/** 路线：绝对坐标折线（从 LOS 起），WR 沿折线匀速跑 */
export interface RouteDef {
  id: string;
  name: string;
  points: Vec2[];
}

export interface PlayDef {
  id: string;
  /** 战术名（Madden 风格） */
  name: string;
  /** 阵型名 */
  formation: string;
  route: RouteDef;
  /** 推荐的球型提示 */
  hint: ThrowType;
  /** 卡片上的提示文案 */
  hintText: string;
}

// ---- 一档结果 ----

export type PlayResultCode = 'complete' | 'overthrow' | 'underthrow' | 'wide' | 'tooLate';

export interface PlayResult {
  code: PlayResultCode;
  throwType: ThrowType;
  /** 球落点 */
  landing: Vec2;
  /** 球到达时 WR 位置 */
  wrPosAtCatch: Vec2;
  /** 落点与 WR 的 2D 距离 */
  distance: number;
  /** 本次判定容差半径 */
  catchRadius: number;
  /** 出手时刻（play 内相对时间） */
  tThrow: number;
  /** 球到达时刻 */
  tCatch: number;
}
