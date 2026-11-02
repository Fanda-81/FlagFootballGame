import * as THREE from 'three';

/** 广告文案：先用游戏名，后续可替换成商务素材 */
export const AD_TITLE = 'FFSIMU';
export const AD_SUB = '腰旗橄榄球 · 传球训练';

const VARIANTS = [
  { bg1: '#0d2b1c', bg2: '#1d6b3a', accent: '#ffd166', text: '#f4fff6' },
  { bg1: '#101a33', bg2: '#2f5fb3', accent: '#7fd4ff', text: '#f4f8ff' },
  { bg1: '#2a1a10', bg2: '#b4551f', accent: '#ffe0a3', text: '#fff6ec' },
];

function drawFootball(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.35);
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.6, r, 0, 0, Math.PI * 2);
  ctx.stroke();
  // 缝线
  ctx.lineWidth = r * 0.1;
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, 0);
  ctx.lineTo(r * 0.7, 0);
  ctx.stroke();
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * r * 0.25, -r * 0.16);
    ctx.lineTo(i * r * 0.25, r * 0.16);
    ctx.stroke();
  }
  ctx.restore();
}

/** 生成一张广告牌贴图（变体 0..2） */
export function makeAdTexture(variant = 0, w = 1024, h = 256): THREE.CanvasTexture {
  const v = VARIANTS[variant % VARIANTS.length];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, v.bg1);
  g.addColorStop(1, v.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 斜纹装饰
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = v.accent;
  ctx.lineWidth = 14;
  for (let i = -h; i < w + h; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, h);
    ctx.lineTo(i + h, 0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 边框
  ctx.strokeStyle = v.accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  drawFootball(ctx, h * 0.42, h / 2, h * 0.26, v.accent);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = v.text;
  ctx.font = `900 ${Math.round(h * 0.44)}px system-ui, "Arial Black", sans-serif`;
  ctx.fillText(AD_TITLE, h * 0.78, h * 0.42);

  ctx.fillStyle = v.accent;
  ctx.font = `700 ${Math.round(h * 0.15)}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText(AD_SUB, h * 0.8, h * 0.74);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
