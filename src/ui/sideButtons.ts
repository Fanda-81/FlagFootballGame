import type { PlayDef, PlayerCard } from '../core/types';
import { randomWRCard } from '../data/cards';
import { addCard, loadCards, loadSettings, resetAll, saveSettings } from '../data/storage';
import { PLAYS } from '../data/plays';
import { offlineAssets } from '../config';
import {
  canPromptInstall,
  downloadOfflinePack,
  isInstalledApp,
  isIOS,
  isOnline,
  isStandalone,
  offlinePackStatus,
  promptInstall,
} from '../offline';
import { openModal } from './modals';
import { routeSvg } from './playCall';
import { CHANGELOG } from '../data/changelog';
import { SHOP_ITEMS } from '../data/shop';
import { loadWallet, saveWallet } from '../data/profile';

/** 更新内容弹窗 */
export function openChangelog(): void {
  const body = document.createElement('div');
  body.innerHTML = CHANGELOG.map(
    (e) => `
    <div class="changelog-entry">
      <div class="changelog-head"><b>v${e.version}</b><span>${e.date}</span></div>
      <ul>${e.items.map((i) => `<li>${i}</li>`).join('')}</ul>
    </div>`,
  ).join('');
  openModal('更新内容', body);
}

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

/** 商城：本地扣费购买（交易系统上线前先本地记账） */
function openShop(opts: { notify: (m: string) => void; onWalletChange: () => void }): void {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="shop-balance" id="shop-balance"></div>
    <div class="shop-grid" id="shop-grid"></div>
    <p style="color:var(--text-dim);font-size:12px;margin-top:12px">
      购买立即扣费并保存在本机；交易系统上线后可跨设备同步。
    </p>`;
  openModal('商城', body);
  const grid = body.querySelector<HTMLElement>('#shop-grid')!;
  const balance = body.querySelector<HTMLElement>('#shop-balance')!;

  const draw = (): void => {
    const w = loadWallet();
    balance.innerHTML = `<span>💎 ${w.diamonds.toLocaleString('en-US')}</span><span>🪙 ${w.coins.toLocaleString('en-US')}</span>`;
    grid.innerHTML = SHOP_ITEMS.map((it) => {
      const owned = w.owned.includes(it.id);
      const price = `${it.currency === 'coins' ? '🪙' : '💎'} ${it.price.toLocaleString('en-US')}`;
      return `<div class="shop-item${owned ? ' owned' : ''}">
        <span class="si-icon">${it.icon}</span>
        <div class="si-info">
          <div class="si-name">${it.name}</div>
          <div class="si-desc">${it.desc}</div>
        </div>
        <span class="si-price">${price}</span>
        <button class="si-buy" data-id="${it.id}"${owned ? ' disabled' : ''}>${owned ? '已拥有' : '购买'}</button>
      </div>`;
    }).join('');

    grid.querySelectorAll<HTMLButtonElement>('.si-buy').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = SHOP_ITEMS.find((i) => i.id === btn.dataset.id);
        if (!item) return;
        const wallet = loadWallet();
        if (wallet.owned.includes(item.id)) return;
        const enough = item.currency === 'coins' ? wallet.coins >= item.price : wallet.diamonds >= item.price;
        if (!enough) {
          opts.notify(item.currency === 'coins' ? '金币不够，先打几档攒一攒' : '钻石不够');
          return;
        }
        if (item.currency === 'coins') wallet.coins -= item.price;
        else wallet.diamonds -= item.price;
        wallet.owned.push(item.id);
        saveWallet(wallet);
        opts.onWalletChange();
        draw();
        opts.notify(`已购买：${item.name}`);
      });
    });
  };
  draw();
}

/** 设置弹窗：音量 / 画质 / 网络 / 离线包 / 安装 / 版本 / 重置 */
function openSettings(opts: {
  onQualityChange: (q: 'high' | 'low') => void;
  onCheckUpdate: () => void;
  notify: (msg: string) => void;
  onVolumeChange: (v: number) => void;
}): void {
  const s = loadSettings();
  const buildTime = new Date(__BUILD_TIME__).toLocaleString('zh-CN', { hour12: false });
  const online = isOnline();
  const standalone = isStandalone() || isInstalledApp();
  const canInstall = canPromptInstall();
  const installHint = standalone
    ? '已安装'
    : canInstall
      ? '可安装'
      : isIOS()
        ? 'iOS：Safari 分享 → 添加到主屏幕'
        : '请用 Chrome / Edge 打开后安装';

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="modal-row"><label>网络</label>
      <span class="set-value ${online ? '' : 'set-warn'}">${online ? '在线' : '离线（商城等联网功能暂停）'}</span></div>
    <div class="modal-row"><label>离线包</label>
      <span class="set-value" id="set-pack">检查中…</span>
      <button class="btn" id="set-pack-btn" style="padding:7px 14px;font-size:13px">下载</button></div>
    <div class="modal-row"><label>安装</label>
      <span class="set-value" id="set-install-state">${installHint}</span>
      <button class="btn" id="set-install-btn" style="padding:7px 14px;font-size:13px"${standalone ? ' disabled' : ''}>${standalone ? '已安装' : '安装到桌面'}</button></div>
    <div class="modal-row"><label>音量</label>
      <input type="range" id="set-volume" min="0" max="1" step="0.05" value="${s.volume}">
      <span id="set-volume-val">${Math.round(s.volume * 100)}%</span></div>
    <div class="modal-row"><label>画质</label>
      <select id="set-quality">
        <option value="high"${s.quality === 'high' ? ' selected' : ''}>高（设备分辨率）</option>
        <option value="low"${s.quality === 'low' ? ' selected' : ''}>低（省电）</option>
      </select></div>
    <div class="modal-row"><label>版本</label>
      <span class="set-value">v${__APP_VERSION__} · ${buildTime}</span>
      <button class="btn" id="set-update" style="padding:7px 14px;font-size:13px">检查更新</button></div>
    <div class="modal-row"><label>更新内容</label>
      <span class="set-value">每次更新都可查看</span>
      <button class="btn" id="set-notes" style="padding:7px 14px;font-size:13px">查看</button></div>
    <div class="modal-row"><label>制作</label>
      <span class="set-value">Fanda</span></div>
    <div class="modal-row"><label>重置数据</label>
      <button class="btn" id="set-reset">清空收藏与设置</button></div>
    <p style="color:var(--text-dim);font-size:12px">「离线包」会把球场模型缓存到本机；缓存完成后断网也能进游戏，联网功能（商城/检查更新）会提示不可用。</p>`;
  const modal = openModal('设置', body);

  const volume = modal.el.querySelector<HTMLInputElement>('#set-volume')!;
  const volumeVal = modal.el.querySelector<HTMLSpanElement>('#set-volume-val')!;
  const quality = modal.el.querySelector<HTMLSelectElement>('#set-quality')!;
  const packEl = modal.el.querySelector<HTMLSpanElement>('#set-pack')!;
  const packBtn = modal.el.querySelector<HTMLButtonElement>('#set-pack-btn')!;
  const installBtn = modal.el.querySelector<HTMLButtonElement>('#set-install-btn')!;

  volume.addEventListener('input', () => {
    volumeVal.textContent = `${Math.round(Number(volume.value) * 100)}%`;
    saveSettings({ ...loadSettings(), volume: Number(volume.value) });
    opts.onVolumeChange(Number(volume.value));
  });

  quality.addEventListener('change', () => {
    const q = quality.value as 'high' | 'low';
    saveSettings({ ...loadSettings(), quality: q });
    opts.onQualityChange(q);
  });

  // ---- 离线包 ----
  const urls = offlineAssets();
  const refreshPack = async (): Promise<void> => {
    const st = await offlinePackStatus(urls);
    if (st.ready) {
      packEl.textContent = `已缓存 ${st.cached}/${st.total} ✓`;
      packBtn.textContent = '已缓存';
      packBtn.disabled = true;
    } else {
      packEl.textContent = `未缓存 ${st.cached}/${st.total}`;
      packBtn.textContent = '下载';
      packBtn.disabled = !isOnline();
    }
  };
  void refreshPack();

  packBtn.addEventListener('click', () => {
    void (async () => {
      if (!isOnline()) {
        opts.notify('离线状态，联网后再下载离线包');
        return;
      }
      packBtn.disabled = true;
      packEl.textContent = '下载中…';
      const ok = await downloadOfflinePack(urls, (done, total) => {
        packEl.textContent = `下载中 ${done}/${total}`;
      });
      if (ok) {
        packEl.textContent = `已缓存 ${urls.length}/${urls.length} ✓`;
        packBtn.textContent = '已缓存';
        opts.notify('离线包已就绪，断网也能玩');
      } else {
        packEl.textContent = '部分资源失败';
        packBtn.textContent = '重试';
        packBtn.disabled = false;
        opts.notify('离线包下载不完整，请检查网络后重试');
      }
    })();
  });

  // ---- 安装 ----
  installBtn.addEventListener('click', () => {
    void (async () => {
      if (standalone) return;
      if (canPromptInstall()) {
        const accepted = await promptInstall();
        opts.notify(accepted ? '正在安装…' : '已取消安装');
        installBtn.textContent = accepted ? '已安装' : '安装到桌面';
        installBtn.disabled = accepted;
      } else {
        opts.notify(isIOS() ? 'Safari：点分享按钮 → 添加到主屏幕' : '浏览器菜单 → 安装应用 / 添加到主屏幕');
      }
    })();
  });

  modal.el.querySelector('#set-update')?.addEventListener('click', () => opts.onCheckUpdate());
  modal.el.querySelector('#set-notes')?.addEventListener('click', () => {
    modal.close();
    openChangelog();
  });

  modal.el.querySelector('#set-reset')?.addEventListener('click', () => {
    resetAll();
    modal.close();
  });
}

/** 战术手册弹窗：全部 13 战术（3 跑阵 + 10 传球），点卡片直接开球 */
function openPlaybook(onSelectPlay: (id: string) => void): void {
  const runPlays = PLAYS.filter((p) => p.kind === 'run');
  const passPlays = PLAYS.filter((p) => p.kind === 'pass');
  const cardHtml = (p: PlayDef) => `
    <div class="play-card">
      <div class="pc-top"><span class="pc-name">${p.name}</span><span class="pc-formation">${p.formation}</span></div>
      <div class="pc-route">${routeSvg(p)}</div>
      <div class="pc-hint">${p.hintText}</div>
    </div>`;

  const body = document.createElement('div');
  body.innerHTML = `
    <h3 class="pb-title">🏃 跑阵（${runPlays.length}）</h3>
    <div class="playbook-grid">${runPlays.map(cardHtml).join('')}</div>
    <h3 class="pb-title">🏈 传球（${passPlays.length}）</h3>
    <div class="playbook-grid">${passPlays.map(cardHtml).join('')}</div>`;
  const modal = openModal(`战术手册（${PLAYS.length} 战术）`, body);

  const all = [...runPlays, ...passPlays];
  modal.el.querySelectorAll('.play-card').forEach((card, i) => {
    card.addEventListener('click', () => {
      modal.close();
      onSelectPlay(all[i].id);
    });
  });
}

export interface SideButtonsOptions {
  onQualityChange: (q: 'high' | 'low') => void;
  /** 战术本点选后开球 */
  onSelectPlay: (playId: string) => void;
  /** 设置里点「检查更新」 */
  onCheckUpdate: () => void;
  /** 轻提示（离线/下载等反馈） */
  notify: (msg: string) => void;
  /** 钱包变化（购买后刷新顶部资产） */
  onWalletChange: () => void;
  /** 音量滑块变化 */
  onVolumeChange: (v: number) => void;
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
  bind('btn-playbook', () => openPlaybook(opts.onSelectPlay));
  bind('btn-shop', () => {
    // 商城是联网功能：离线时不开放，其余玩法不受影响
    if (!isOnline()) {
      opts.notify('商城需要联网，离线时暂不可用');
      return;
    }
    openShop(opts);
  });
  bind('btn-settings', () => openSettings(opts));
}
