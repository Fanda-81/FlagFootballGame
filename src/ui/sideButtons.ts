import type { PlayerCard } from '../core/types';
import { randomWRCard } from '../data/cards';
import { addCard, loadCards, loadSettings, resetAll, saveSettings } from '../data/storage';
import { openModal } from './modals';

const RARITY_LABEL: Record<string, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
};

function attrRow(card: PlayerCard): string {
  const chips = Object.entries(card.attrs)
    .map(([k, v]) => `<span class="attr-chip">${k} <b>${v}</b></span>`)
    .join('');
  return `
    <div class="player-card rarity-${card.rarity}">
      <div class="pc-avatar">${card.position === 'QB' ? '🏈' : '🏃'}</div>
      <div class="pc-info">
        <div class="pc-name">${card.name}</div>
        <div class="pc-pos">${card.position} · ${RARITY_LABEL[card.rarity] ?? card.rarity}</div>
        <div class="pc-attrs">${chips}</div>
      </div>
    </div>`;
}

/** 抽卡弹窗：抽一张随机 WR 卡并入库 */
function openDraw(): void {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="draw-result" id="draw-area">
      <p style="color:var(--text-dim)">点下方按钮抽取一张随机外接手卡</p>
    </div>
    <div style="text-align:center;padding-bottom:6px">
      <button class="btn primary" id="draw-btn">🎴 抽卡</button>
    </div>`;
  const modal = openModal('抽卡', body);

  modal.el.querySelector('#draw-btn')?.addEventListener('click', () => {
    const card = randomWRCard();
    addCard(card);
    const area = modal.el.querySelector('#draw-area');
    if (area) {
      area.innerHTML = `
        <div class="draw-name">${card.name}</div>
        ${attrRow(card)}
        <p style="color:var(--good);font-weight:700">已加入球员卡收藏！</p>`;
    }
  });
}

/** 球员卡收藏弹窗 */
function openCards(): void {
  const cards = loadCards();
  const body = document.createElement('div');
  body.innerHTML = `<div class="card-grid">${cards.map(attrRow).join('')}</div>`;
  openModal(`球员卡（${cards.length}）`, body);
}

/** 商城骨架弹窗（MVP 占位） */
function openShop(): void {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="modal-row"><label>👕 个性化球衣</label><span style="color:var(--text-dim)">敬请期待</span></div>
    <div class="modal-row"><label>🩳 装备配件</label><span style="color:var(--text-dim)">敬请期待</span></div>
    <div class="modal-row"><label>🏟️ 球场主题</label><span style="color:var(--text-dim)">敬请期待</span></div>
    <p style="color:var(--text-dim);font-size:12px">商城将在后续版本接入；当前可先在「抽卡」收集球员。</p>`;
  openModal('商城', body);
}

/** 设置弹窗：音量 / 画质 / 重置数据 */
function openSettings(onQualityChange: (q: 'high' | 'low') => void): void {
  const s = loadSettings();
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="modal-row"><label>🔊 音量</label>
      <input type="range" id="set-volume" min="0" max="1" step="0.05" value="${s.volume}">
      <span id="set-volume-val">${Math.round(s.volume * 100)}%</span></div>
    <div class="modal-row"><label>🖥️ 画质</label>
      <select id="set-quality">
        <option value="high"${s.quality === 'high' ? ' selected' : ''}>高（设备分辨率）</option>
        <option value="low"${s.quality === 'low' ? ' selected' : ''}>低（省电）</option>
      </select></div>
    <div class="modal-row"><label>♻️ 重置数据</label>
      <button class="btn" id="set-reset">清空收藏与设置</button></div>
    <p style="color:var(--text-dim);font-size:12px">设置自动保存。</p>`;
  const modal = openModal('设置', body);

  const volume = modal.el.querySelector<HTMLInputElement>('#set-volume')!;
  const volumeVal = modal.el.querySelector<HTMLSpanElement>('#set-volume-val')!;
  const quality = modal.el.querySelector<HTMLSelectElement>('#set-quality')!;

  volume.addEventListener('input', () => {
    volumeVal.textContent = `${Math.round(Number(volume.value) * 100)}%`;
    saveSettings({ ...loadSettings(), volume: Number(volume.value) });
  });

  quality.addEventListener('change', () => {
    const q = quality.value as 'high' | 'low';
    saveSettings({ ...loadSettings(), quality: q });
    onQualityChange(q);
  });

  modal.el.querySelector('#set-reset')?.addEventListener('click', () => {
    resetAll();
    modal.close();
  });
}

export interface SideButtonsOptions {
  onQualityChange: (q: 'high' | 'low') => void;
}

/** 绑定左右功能按钮 */
export function bindSideButtons(opts: SideButtonsOptions): void {
  const bind = (id: string, fn: () => void) => {
    const btn = document.getElementById(id);
    if (!btn) throw new Error(`找不到 #${id}`);
    btn.addEventListener('click', fn);
  };
  bind('btn-draw', openDraw);
  bind('btn-cards', openCards);
  bind('btn-shop', openShop);
  bind('btn-settings', () => openSettings(opts.onQualityChange));
}
