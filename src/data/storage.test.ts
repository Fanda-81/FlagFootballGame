// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_QB_CARD, DEFAULT_WR_CARD, randomWRCard } from '../data/cards';
import {
  DEFAULT_SETTINGS,
  addCard,
  loadCards,
  loadSettings,
  resetAll,
  saveSettings,
} from './storage';

describe('storage 持久化（localStorage）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('首次访问：收藏 = 默认 QB + WR 两张卡', () => {
    const cards = loadCards();
    expect(cards).toHaveLength(2);
    expect(cards[0].id).toBe(DEFAULT_QB_CARD.id);
    expect(cards[1].id).toBe(DEFAULT_WR_CARD.id);
  });

  it('抽卡入册：addCard 追加并持久化，重载后仍在', () => {
    const newCard = randomWRCard(() => 0.5);
    addCard(newCard);
    const reloaded = loadCards();
    expect(reloaded).toHaveLength(3);
    expect(reloaded[2].id).toBe(newCard.id);
    expect(reloaded[2].attrs.SPD).toBe(newCard.attrs.SPD);
  });

  it('损坏的 JSON 容错回退默认两张卡', () => {
    localStorage.setItem('ffp.cards.v1', '{broken json');
    const cards = loadCards();
    expect(cards).toHaveLength(2);
  });

  it('设置：默认值 + 保存往返 + 部分字段合并默认', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    saveSettings({ volume: 0.3, quality: 'low' });
    expect(loadSettings()).toEqual({ volume: 0.3, quality: 'low' });
    // 缺字段时用默认补齐
    localStorage.setItem('ffp.settings.v1', JSON.stringify({ volume: 0.5 }));
    expect(loadSettings()).toEqual({ volume: 0.5, quality: 'high' });
  });

  it('重置：清空卡牌与设置', () => {
    addCard(randomWRCard(() => 0.5));
    saveSettings({ volume: 0.1, quality: 'low' });
    resetAll();
    expect(loadCards()).toHaveLength(2);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
