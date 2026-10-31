import { PLAYS } from '../data/plays';
import type { PlayDef } from '../core/types';

/**
 * Madden 风格战术卡片横滚列表：每张卡片含路线 SVG 图 + 战术名 + 阵型 + 球型提示。
 * 路线映射：球场 x∈[-13.35,13.35] → svgX[10,110]；z∈[-3,45] → svgY[62,8]（纵深向上）。
 */
function routeSvg(play: PlayDef): string {
  const svgX = (x: number) => 60 + x * 3.7;
  const svgY = (z: number) => 62 - (z + 3) * 1.125;

  const pts = play.route.points.map((p) => `${svgX(p.x).toFixed(1)},${svgY(p.z).toFixed(1)}`).join(' ');
  const start = play.route.points[0];
  const end = play.route.points[play.route.points.length - 1];

  // 箭头：最后一段方向
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

export interface PlayCallHandle {
  setSelected(id: string | null): void;
  setEnabled(enabled: boolean): void;
}

export function renderPlayCall(
  container: HTMLElement,
  onSelect: (playId: string) => void,
): PlayCallHandle {
  container.innerHTML = '';
  const cards = PLAYS.map((play) => {
    const card = document.createElement('div');
    card.className = 'play-card';
    card.innerHTML = `
      <div class="pc-top">
        <span class="pc-name">${play.name}</span>
        <span class="pc-formation">${play.formation}</span>
      </div>
      <div class="pc-route">${routeSvg(play)}</div>
      <div class="pc-hint">${play.hintText}</div>
    `;
    card.addEventListener('click', () => onSelect(play.id));
    container.appendChild(card);
    return { card, play };
  });

  return {
    setSelected(id) {
      for (const { card, play } of cards) {
        card.classList.toggle('selected', play.id === id);
      }
    },
    setEnabled(enabled) {
      container.style.opacity = enabled ? '1' : '0.45';
      container.style.pointerEvents = enabled ? 'auto' : 'none';
    },
  };
}
