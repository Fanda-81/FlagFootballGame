import type { PlayerCard } from '../core/types';
import { DEFAULT_QB_CARD, DEFAULT_WR_CARD } from './cards';

const CARDS_KEY = 'ffp.cards.v1';
const SETTINGS_KEY = 'ffp.settings.v1';

export interface GameSettings {
  /** 音量 0..1（当前仅存储，音效为路线图项） */
  volume: number;
  /** 画质：high = 设备像素比（≤2），low = 1x */
  quality: 'high' | 'low';
}

export const DEFAULT_SETTINGS: GameSettings = { volume: 0.8, quality: 'high' };

/** 收藏的球员卡（含默认两张）；解析失败回退默认 */
export function loadCards(): PlayerCard[] {
  try {
    const raw = localStorage.getItem(CARDS_KEY);
    if (!raw) return [DEFAULT_QB_CARD, DEFAULT_WR_CARD];
    const parsed = JSON.parse(raw) as PlayerCard[];
    if (!Array.isArray(parsed)) throw new Error('格式错误');
    return parsed;
  } catch {
    return [DEFAULT_QB_CARD, DEFAULT_WR_CARD];
  }
}

function saveCards(cards: PlayerCard[]): void {
  localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
}

/** 抽到的卡加入收藏并持久化 */
export function addCard(card: PlayerCard): PlayerCard[] {
  const cards = loadCards();
  cards.push(card);
  saveCards(cards);
  return cards;
}

/** 读取设置（缺字段用默认补齐） */
export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: GameSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/** 重置全部数据 */
export function resetAll(): void {
  localStorage.removeItem(CARDS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
}
