import type { PlayDef, ThrowType } from '../core/types';
import { getRoute } from '../gameplay/routes';

/**
 * 战术手册：13 个进攻战术（3 跑阵 + 10 传球，对应参考图战术板分类）。
 */
export const PLAYS: PlayDef[] = [
  // ---- 传球战术（Pass）----
  {
    id: 'slant', name: 'Quick Slant', formation: 'Gun Spread', kind: 'pass',
    route: getRoute('slant'), hint: 'bullet', hintText: '短传快切 · 平快球',
  },
  {
    id: 'hitch', name: 'Hitch', formation: 'Gun Spread', kind: 'pass',
    route: getRoute('hitch'), hint: 'bullet', hintText: '急停回身 · 平快球',
  },
  {
    id: 'out', name: 'Out Route', formation: 'Singleback', kind: 'pass',
    route: getRoute('out'), hint: 'bullet', hintText: '外切边线 · 平快球',
  },
  {
    id: 'curl', name: 'Curl', formation: 'Gun Spread', kind: 'pass',
    route: getRoute('curl'), hint: 'bullet', hintText: '回身内钩 · 平快球',
  },
  {
    id: 'drag', name: 'Drag', formation: 'Gun Trips', kind: 'pass',
    route: getRoute('drag'), hint: 'bullet', hintText: '浅区横穿 · 平快球',
  },
  {
    id: 'go', name: 'Go Route', formation: 'Singleback', kind: 'pass',
    route: getRoute('go'), hint: 'lob', hintText: '纵深冲刺 · 高球',
  },
  {
    id: 'post', name: 'Post', formation: 'Singleback', kind: 'pass',
    route: getRoute('post'), hint: 'lob', hintText: '内切深区 · 高球',
  },
  {
    id: 'corner', name: 'Corner', formation: 'Gun Spread', kind: 'pass',
    route: getRoute('corner'), hint: 'lob', hintText: '角旗路线 · 高球',
  },
  {
    id: 'comeback', name: 'Comeback', formation: 'Singleback', kind: 'pass',
    route: getRoute('comeback'), hint: 'lob', hintText: '回身外钩 · 高球',
  },
  {
    id: 'fade', name: 'Fade', formation: 'Gun Trips', kind: 'pass',
    route: getRoute('fade'), hint: 'lob', hintText: '边线纵深 · 高球',
  },
  // ---- 跑阵战术（Run）----
  {
    id: 'dive', name: 'Dive', formation: 'I-Form', kind: 'run',
    route: getRoute('dive'), hint: 'bullet', hintText: '中路直冲',
  },
  {
    id: 'sweep', name: 'Sweep', formation: 'I-Form', kind: 'run',
    route: getRoute('sweep'), hint: 'bullet', hintText: '外侧横扫',
  },
  {
    id: 'reverse', name: 'Reverse', formation: 'I-Form', kind: 'run',
    route: getRoute('reverse'), hint: 'bullet', hintText: '反向跑',
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
