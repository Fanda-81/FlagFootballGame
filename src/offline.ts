/**
 * 离线与安装能力：
 *  - 在线状态订阅（离线时隐藏联网功能）
 *  - 离线资源包（把球场/球员模型预热进 Service Worker 的 ffp-models 缓存）
 *  - PWA 安装（Android/桌面走 beforeinstallprompt，iOS 给出「添加到主屏幕」指引）
 *
 * 缓存名必须与 vite.config.ts 里 workbox.runtimeCaching 的 cacheName 一致，
 * 这样这里预热的模型，离线时会被 Service Worker 的 CacheFirst 直接命中。
 */
export const MODEL_CACHE = 'ffp-models';

export interface OfflinePackStatus {
  total: number;
  cached: number;
  ready: boolean;
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/** 订阅在线状态（立即回调一次） */
export function watchConnectivity(cb: (online: boolean) => void): () => void {
  const on = () => cb(true);
  const off = () => cb(false);
  window.addEventListener('online', on);
  window.addEventListener('offline', off);
  cb(isOnline());
  return () => {
    window.removeEventListener('online', on);
    window.removeEventListener('offline', off);
  };
}

/** 资源是否已在任意缓存里（预缓存 / 运行时缓存都算） */
async function isCached(url: string): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    // Workbox 预缓存会在 URL 上带 ?__WB_REVISION__=xxx，必须忽略 query 才能命中
    return !!(await caches.match(url, { ignoreSearch: true }));
  } catch {
    return false;
  }
}

export async function offlinePackStatus(urls: string[]): Promise<OfflinePackStatus> {
  if (typeof caches === 'undefined') return { total: urls.length, cached: 0, ready: false };
  let cached = 0;
  for (const url of urls) {
    if (await isCached(url)) cached += 1;
  }
  return { total: urls.length, cached, ready: cached >= urls.length };
}

/**
 * 下载/预热离线包。已在预缓存或运行时缓存里的不重复下载。
 * 返回是否全部就绪。
 */
export async function downloadOfflinePack(
  urls: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  const cache = await caches.open(MODEL_CACHE);
  let done = 0;
  for (const url of urls) {
    try {
      if (!(await isCached(url))) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await cache.put(url, res.clone());
      }
    } catch (e) {
      console.warn('[offline] 资源缓存失败：', url, e);
    }
    done += 1;
    onProgress?.(done, urls.length);
  }
  return (await offlinePackStatus(urls)).ready;
}

/** 已安装为独立 App（从主屏幕启动） */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return inDisplayMode() || ios;
}

function inDisplayMode(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
}

/* ---------------- 安装 ---------------- */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installWatchers = new Set<(canInstall: boolean) => void>();
let installedFlag = isStandalone();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installWatchers.forEach((cb) => cb(true));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedFlag = true;
    installWatchers.forEach((cb) => cb(false));
  });
}

/** 能否弹出系统安装框（Chrome/Edge/Android） */
export function canPromptInstall(): boolean {
  return !!deferredPrompt && !installedFlag;
}

export function isInstalledApp(): boolean {
  return installedFlag;
}

export function watchInstall(cb: (canInstall: boolean) => void): () => void {
  installWatchers.add(cb);
  cb(canPromptInstall());
  return () => installWatchers.delete(cb);
}

/** 弹出系统安装框；返回用户是否接受 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const evt = deferredPrompt;
  deferredPrompt = null;
  await evt.prompt();
  const { outcome } = await evt.userChoice;
  if (outcome === 'accepted') installedFlag = true;
  installWatchers.forEach((cb) => cb(canPromptInstall()));
  return outcome === 'accepted';
}
