/**
 * 无依赖生成 PWA 图标（192/512 PNG）：
 * 深绿圆角背景 + 球场码线 + 棕色橄榄球（中心横缝线）。
 * 手写 PNG 编码（zlib deflate + CRC32）。
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// ---- CRC32 ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 每行加 filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 绘制 ----
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };
  const r = size * 0.22; // 圆角半径
  const inRoundedRect = (x, y) => {
    const cx = Math.min(Math.max(x, r), size - 1 - r);
    const cy = Math.min(Math.max(y, r), size - 1 - r);
    return Math.hypot(x - cx, y - cy) <= r + 0.5 || (x >= r && x < size - r) || (y >= r && y < size - r);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundedRect(x, y)) continue; // 透明圆角外
      // 草地底色（上下渐变）
      const t = y / size;
      const g = Math.round(45 + 25 * t);
      set(x, y, 11, g, 31);
      // 码线：底部区域每 0.06 一条白线
      if (y > size * 0.55 && (y % Math.round(size * 0.06)) < Math.max(1, size * 0.006)) {
        set(x, y, 235, 240, 245, 160);
      }
      // 边线
      if (Math.abs(x - size * 0.12) < 1 || Math.abs(x - size * 0.88) < 1) {
        set(x, y, 235, 240, 245, 180);
      }
      // 橄榄球（椭圆 + 缝线 + 两端白尖）
      const cx = size / 2;
      const cy = size * 0.42;
      const rx = size * 0.3;
      const ry = size * 0.115;
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        const isSeam = Math.abs(y - cy) < Math.max(1, size * 0.006) && Math.abs(x - cx) < rx * 0.7;
        const isTip = Math.abs(x - (cx + rx)) < rx * 0.06 || Math.abs(x - (cx - rx)) < rx * 0.06;
        if (isSeam || isTip) set(x, y, 245, 245, 245);
        else set(x, y, 141, 85, 36);
      }
    }
  }
  return encodePng(size, px);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const s of [192, 512]) {
  const file = join(OUT_DIR, `icon-${s}.png`);
  writeFileSync(file, drawIcon(s));
  console.log(`生成 ${file}`);
}
