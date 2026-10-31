import type { CardRarity, PlayerCard, QBAttrs, WRAttrs } from '../core/types';

/** 默认 QB 卡（玩家主视角） */
export const DEFAULT_QB_CARD: PlayerCard = {
  id: 'qb-01',
  name: '天枢·镇场者',
  position: 'QB',
  attrs: { THP: 88, TAC: 85, SPD: 70, AWR: 82 } satisfies QBAttrs,
  rarity: 'epic',
};

/** 默认 WR 卡（训练搭档） */
export const DEFAULT_WR_CARD: PlayerCard = {
  id: 'wr-01',
  name: '疾风·斜插者',
  position: 'WR',
  attrs: { SPD: 85, CTH: 80, RTE: 78, AGI: 82 } satisfies WRAttrs,
  rarity: 'rare',
};

const WR_NAMES = ['疾风', '闪电', '猎鹰', '暴风', '流星', '天火', '利刃', '猛虎', '飞翼', '雷光'];
const WR_TITLES = ['接球手', '外接手', '锋线新星', '老将', '快腿', '高炮台'];

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** 近似正态属性：三骰取均值（60-95 区间，向中值收拢） */
function normalAttr(rng: () => number): number {
  const avg = (rng() + rng() + rng()) / 3;
  return Math.round(60 + avg * 35);
}

function rollRarity(total: number): CardRarity {
  if (total >= 330) return 'epic';
  if (total >= 300) return 'rare';
  return 'common';
}

/** 随机生成一张 WR 卡（抽卡用） */
export function randomWRCard(rng: () => number = Math.random): PlayerCard {
  const attrs: WRAttrs = {
    SPD: normalAttr(rng),
    CTH: normalAttr(rng),
    RTE: normalAttr(rng),
    AGI: normalAttr(rng),
  };
  const total = attrs.SPD + attrs.CTH + attrs.RTE + attrs.AGI;
  const name = `${WR_NAMES[randInt(rng, 0, WR_NAMES.length - 1)]}·${WR_TITLES[randInt(rng, 0, WR_TITLES.length - 1)]}`;
  return {
    id: `wr-${Date.now().toString(36)}-${randInt(rng, 0, 9999)}`,
    name,
    position: 'WR',
    attrs,
    rarity: rollRarity(total),
  };
}
