/** 商城物品（MVP：本地扣费，等交易系统上线再接服务端） */
export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  price: number;
  currency: 'coins' | 'diamonds';
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'jersey_home', name: '球衣 · 主场蓝', desc: '主队配色的比赛球衣', icon: '👕', price: 800, currency: 'coins' },
  { id: 'jersey_dusk', name: '球衣 · 黄昏橙', desc: '夕阳配色的限定球衣', icon: '🧥', price: 1200, currency: 'coins' },
  { id: 'gloves', name: '接球手套', desc: '接球容错 +2%（占位）', icon: '🧤', price: 1500, currency: 'coins' },
  { id: 'field_neon', name: '球场主题 · 霓虹', desc: '夜场霓虹灯光（占位）', icon: '🏟️', price: 60, currency: 'diamonds' },
  { id: 'avatar_gold', name: '头像框 · 金色', desc: '个人资料金色边框', icon: '🖼️', price: 80, currency: 'diamonds' },
  { id: 'cleats', name: '钉鞋 · 疾风', desc: '速度 +1%（占位）', icon: '👟', price: 2200, currency: 'coins' },
];
