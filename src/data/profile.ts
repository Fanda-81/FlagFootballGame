import type { PlayerCard } from '../core/types';

/** 玩家资料 */
export interface Profile {
  name: string;
  avatar: string;
  avatarColor: string;
}

/** 资产（钻石/金币）与已购物品 */
export interface Wallet {
  diamonds: number;
  coins: number;
  owned: string[];
}

const PROFILE_KEY = 'ffp.profile.v1';
const WALLET_KEY = 'ffp.wallet.v1';

export const DEFAULT_PROFILE: Profile = { name: '新秀球员', avatar: '🏈', avatarColor: '#2f7fe0' };
export const DEFAULT_WALLET: Wallet = { diamonds: 100, coins: 20000, owned: [] };

export const AVATAR_CHOICES = ['🏈', '🔥', '🦅', '🐯', '👑', '🎯', '⚡', '🛡️'];
export const AVATAR_COLORS = ['#2f7fe0', '#e0544a', '#43d17c', '#ffb300', '#a78bfa', '#f472b6'];

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const p = JSON.parse(raw) as Partial<Profile>;
    return { ...DEFAULT_PROFILE, ...p };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function loadWallet(): Wallet {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (!raw) return { ...DEFAULT_WALLET, owned: [] };
    const w = JSON.parse(raw) as Partial<Wallet>;
    return {
      diamonds: typeof w.diamonds === 'number' ? w.diamonds : DEFAULT_WALLET.diamonds,
      coins: typeof w.coins === 'number' ? w.coins : DEFAULT_WALLET.coins,
      owned: Array.isArray(w.owned) ? w.owned : [],
    };
  } catch {
    return { ...DEFAULT_WALLET, owned: [] };
  }
}

export function saveWallet(w: Wallet): void {
  localStorage.setItem(WALLET_KEY, JSON.stringify(w));
}

/** 兼容旧存档：把球员卡收藏也算进来（目前只用于展示） */
export function totalCards(cards: PlayerCard[]): number {
  return cards.length;
}
