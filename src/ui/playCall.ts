import { PLAYS } from '../data/plays';
import type { PlayDef } from '../core/types';

/**
 * ACTION MENU（Madden 风格）：底部居中三个大按钮，点开后在按钮上方浮出组内战术卡片。
 * 路线映射：球场 x∈[-13.35,13.35] → svgX[10,110]；z∈[-3,45] → svgY[62,8]（纵深向上）。
 */
export function routeSvg(play: PlayDef): string {  const svgX = (x: number) => 60 + x * 3.7;
  const svgY = (z: number) => 62 - (z + 3) * 1.125;

  const pts = play.route.points.map((p) => `${svgX(p.x).toFixed(1)},${svgY(p.z).toFixed(1)}`).join(' ');
  const start = play.route.points[0];
  const end = play.route.points[play.route.points.length - 1];

  const seg = play.route.points.length > 1 ? play.route.points[play.route.points.length - 2] : null;
  const dx = seg ? svgX(end.x) - svgX(seg.x) : 0;
  const dy = seg ? svgY(end.z) - svgY(seg.z) : -10;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const ax = svgX(end.x);
  const ay = svgY(end.z);
  const hx1 = ax - ux * 8 - uy * 5;
  const hy1 = ay - uy * 8 + ux * 5;
  const hx2 = ax - ux * 8 + uy * 5;
  const hy2 = ay - uy * 8 - ux * 5;

  return `
    <svg viewBox="0 0 120 70" preserveAspectRatio="xMidYMid meet">
      <line x1="10" y1="${svgY(0)}" x2="110" y2="${svgY(0)}" stroke="#3a5a8c" stroke-width="1" stroke-dasharray="3 3"/>
      <circle cx="${svgX(0)}" cy="${svgY(-3)}" r="2.5" fill="#2f7fe0"/>
      <polyline points="${pts}" fill="none" stroke="#ffb300" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${svgX(start.x)}" cy="${svgY(start.z)}" r="3" fill="#e8e8e8"/>
      <polygon points="${ax},${ay} ${hx1},${hy1} ${hx2},${hy2}" fill="#ffb300"/>
    </svg>`;
}

export interface PlayGroup {
  id: string;
  title: string;
  icon: string;
  sub: string;
  /** 组内战术；空数组表示随机应变 */
  playIds: string[];
}

export const PLAY_GROUPS: PlayGroup[] = [
  { id: 'short', title: 'SHORT PASS', icon: '⏱️', sub: '短传', playIds: ['slant', 'hitch', 'out', 'curl', 'drag'] },
  { id: 'long', title: 'LONG BALL', icon: '🎯', sub: '长传', playIds: ['go', 'post', 'corner', 'comeback', 'fade'] },
];

export interface ActionMenuOptions {
  onSelectPlay: (playId: string) => void;
  /** 预留：随机/跑球等模式（当前未启用） */
  onReact?: () => void;
}

export interface ActionMenuHandle {
  setSelected(id: string | null): void;
  setEnabled(enabled: boolean): void;
  /** 关闭战术卡片浮层 */
  closeCards(): void;
}

export function renderActionMenu(container: HTMLElement, opts: ActionMenuOptions): ActionMenuHandle {
  container.innerHTML = '';

  // 三按钮面板
  const menu = document.createElement('div');
  menu.id = 'action-menu';

  // 卡片浮层（按钮上方）
  const pop = document.createElement('div');
  pop.id = 'playcard-pop';
  pop.className = 'hidden';
  container.appendChild(pop);



  const renderCards = (group: PlayGroup) => {

    pop.innerHTML = '';
    for (const playId of group.playIds) {
      const play = PLAYS.find((p) => p.id === playId)!;
      const card = document.createElement('div');
      card.className = 'play-card';
      card.innerHTML = `
        <div class="pc-top">
          <span class="pc-name">${play.name}</span>
          <span class="pc-formation">${play.formation}</span>
        </div>
        <div class="pc-route">${routeSvg(play)}</div>
        <div class="pc-hint">${play.hintText}</div>`;
      card.addEventListener('click', () => {
        pop.classList.add('hidden');
        opts.onSelectPlay(play.id);
      });
      pop.appendChild(card);
    }
    pop.classList.remove('hidden');
  };

  for (const group of PLAY_GROUPS) {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.innerHTML = `
      <span class="ab-icon">${group.icon}</span>
      <span class="ab-title">${group.title}</span>
      <span class="ab-sub">${group.sub}</span>`;
    btn.addEventListener('click', () => {
      if (group.playIds.length > 0) {
        renderCards(group);
      } else {
        pop.classList.add('hidden');
        opts.onReact?.();
      }
    });
    menu.appendChild(btn);
  }
  container.appendChild(menu);

  // 点空白处关闭浮层
  container.addEventListener('click', (e) => {
    if (e.target === container || e.target === menu) {
      pop.classList.add('hidden');

    }
  });

  return {
    setSelected(id) {
      // 战术卡片选中态由浮层卡片承担；此处同步卡片高亮
      for (const card of Array.from(pop.querySelectorAll<HTMLElement>('.play-card'))) {
        const nameEl = card.querySelector('.pc-name');
        const play = PLAYS.find((p) => p.name === nameEl?.textContent);
        card.classList.toggle('selected', play?.id === id);
      }
    },
    setEnabled(enabled) {
      menu.style.opacity = enabled ? '1' : '0.45';
      menu.style.pointerEvents = enabled ? 'auto' : 'none';
    },
    closeCards() {
      pop.classList.add('hidden');

    },
  };
}
