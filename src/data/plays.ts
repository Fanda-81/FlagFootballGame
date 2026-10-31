import type { PlayDef, ThrowType } from '../core/types';
import { getRoute } from '../gameplay/routes';

/**
 * 战术库：Madden 风格阵型 + 路线 + 推荐球型
 */
export const PLAYS: PlayDef[] = [
  {
    id: 'slant',
    name: 'Quick Slant',
    formation: 'Gun Spread',
    route: getRoute('slant'),
    hint: 'bullet',
    hintText: '短传快切 · 建议平快球',
  },
  {
    id: 'hitch',
    name: 'Hitch',
    formation: 'Gun Spread',
    route: getRoute('hitch'),
    hint: 'bullet',
    hintText: '急停回身 · 建议平快球',
  },
  {
    id: 'out',
    name: 'Out Route',
    formation: 'Singleback',
    route: getRoute('out'),
    hint: 'bullet',
    hintText: '外切边线 · 建议平快球',
  },
  {
    id: 'go',
    name: 'Go Route',
    formation: 'Singleback',
    route: getRoute('go'),
    hint: 'lob',
    hintText: '纵深冲刺 · 建议高球',
  },
];

export function getPlay(id: string): PlayDef {
  const p = PLAYS.find((play) => play.id === id);
  if (!p) throw new Error(`未知战术: ${id}`);
  return p;
}

/** 判定一次出手的球型是否与战术推荐一致 */
export function isRecommendedThrow(play: PlayDef, type: ThrowType): boolean {
  return play.hint === type;
}
