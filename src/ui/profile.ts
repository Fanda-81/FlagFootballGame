import { openModal } from './modals';
import type { Theme } from '../three/scene';
import {
  AVATAR_CHOICES,
  AVATAR_COLORS,
  DEFAULT_PROFILE,
  loadProfile,
  loadWallet,
  saveProfile,
  type Profile,
} from '../data/profile';

/** 刷新顶部个人资料条 */
export function renderProfileChip(): void {
  const p = loadProfile();
  const av = document.getElementById('hud-avatar');
  const nm = document.getElementById('hud-name');
  if (av) {
    av.textContent = p.avatar;
    av.style.background = p.avatarColor;
  }
  if (nm) nm.textContent = p.name;
}

/** 刷新顶部资产 */
export function renderWallet(): void {
  const w = loadWallet();
  const d = document.getElementById('hud-diamonds');
  const c = document.getElementById('hud-coins');
  if (d) d.textContent = w.diamonds.toLocaleString('en-US');
  if (c) c.textContent = w.coins.toLocaleString('en-US');
}

function clampName(input: string): string {
  const name = input.trim().replace(/\s+/g, ' ').slice(0, 12);
  return name || DEFAULT_PROFILE.name;
}

/** 个人信息栏：改用户名 / 头像 / 头像底色 / 球场 */
export function openProfile(opts: {
  onSaved: () => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
}): void {
  const p = loadProfile();
  let avatar = p.avatar;
  let color = p.avatarColor;
  let theme = opts.theme;

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="profile-head">
      <span class="prof-avatar" id="pf-avatar" style="background:${color}">${avatar}</span>
      <div class="profile-meta">
        <b id="pf-preview">${p.name}</b>
        <span>FFSIMU 球员 · 资料保存在本机</span>
      </div>
    </div>
    <label class="field-label" for="pf-input">用户名</label>
    <input class="name-input" id="pf-input" maxlength="12" value="${p.name}" placeholder="最多 12 个字符" />
    <label class="field-label">头像</label>
    <div class="avatar-grid">
      ${AVATAR_CHOICES.map(
        (a) => `<button class="avatar-opt${a === avatar ? ' selected' : ''}" data-av="${a}" aria-label="头像 ${a}">${a}</button>`,
      ).join('')}
    </div>
    <label class="field-label">头像底色</label>
    <div class="color-grid">
      ${AVATAR_COLORS.map(
        (c) => `<button class="color-opt${c === color ? ' selected' : ''}" data-color="${c}" style="background:${c}" aria-label="颜色 ${c}"></button>`,
      ).join('')}
    </div>
    <label class="field-label">球场</label>
    <div class="theme-grid">
      <button class="theme-opt${theme === 'street' ? ' selected' : ''}" data-theme="street">
        <span class="th-icon">🌆</span><span>街头黄昏</span>
      </button>
      <button class="theme-opt${theme === 'campus' ? ' selected' : ''}" data-theme="campus">
        <span class="th-icon">🎓</span><span>校园白天</span>
      </button>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
      <button class="btn" id="pf-cancel">取消</button>
      <button class="btn primary" id="pf-save">保存</button>
    </div>`;

  const modal = openModal('个人信息', body);
  const avatarEl = modal.el.querySelector<HTMLElement>('#pf-avatar')!;
  const previewEl = modal.el.querySelector<HTMLElement>('#pf-preview')!;
  const input = modal.el.querySelector<HTMLInputElement>('#pf-input')!;

  input.addEventListener('input', () => {
    previewEl.textContent = clampName(input.value);
  });

  modal.el.querySelectorAll<HTMLButtonElement>('.avatar-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      avatar = btn.dataset.av ?? avatar;
      avatarEl.textContent = avatar;
      modal.el.querySelectorAll('.avatar-opt').forEach((b) => b.classList.toggle('selected', b === btn));
    });
  });

  modal.el.querySelectorAll<HTMLButtonElement>('.color-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      color = btn.dataset.color ?? color;
      avatarEl.style.background = color;
      modal.el.querySelectorAll('.color-opt').forEach((b) => b.classList.toggle('selected', b === btn));
    });
  });

  modal.el.querySelectorAll<HTMLButtonElement>('.theme-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      theme = (btn.dataset.theme as Theme) ?? theme;
      opts.onTheme(theme);
      modal.el.querySelectorAll('.theme-opt').forEach((b) => b.classList.toggle('selected', b === btn));
    });
  });

  modal.el.querySelector('#pf-cancel')?.addEventListener('click', () => modal.close());
  modal.el.querySelector('#pf-save')?.addEventListener('click', () => {
    const next: Profile = { name: clampName(input.value), avatar, avatarColor: color };
    saveProfile(next);
    modal.close();
    opts.onSaved();
  });
}
