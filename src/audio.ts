/**
 * 极简合成音效（WebAudio，无需音频素材）：
 * 传球破空、接球闷响、观众欢呼、失误闷响。
 * 首次用户手势时创建 AudioContext（浏览器自动播放策略）。
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.8;

export function initAudio(initialVolume = 0.8): void {
  volume = initialVolume;
  if (ctx) return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
}

export function setVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v));
  if (master) master.gain.value = volume;
}

function ready(): AudioContext | null {
  if (!ctx) initAudio(volume);
  if (!ctx || !master) return null;
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** 传球：短促的破空声 */
export function playPass(): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.35);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900, t);
  filter.frequency.exponentialRampToValueAtTime(2600, t + 0.18);
  filter.Q.value = 0.8;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.5, t + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
  src.stop(t + 0.34);
}

/** 接球：低频闷响 + 轻微布料摩擦 */
export function playCatch(): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.14);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.7, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.2);

  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, 0.12);
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 1200;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.18, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  n.connect(f).connect(ng).connect(master);
  n.start(t);
}

/** 观众欢呼：一团噪声的缓慢起伏 */
export function playCheer(): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 1.4);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 700;
  f.Q.value = 0.6;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.28, t + 0.18);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + 1.4);
}

/** 失误：闷响 + 低沉的叹息感 */
export function playMiss(): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.35);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.42, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.42);
}
