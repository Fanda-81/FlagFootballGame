/**
 * PWA 更新流程：
 *   registerType: 'prompt' + onNeedRefresh → 页面上出现「立即更新」按钮，
 *   用户点一下才 activate 新 Service Worker 并刷新，保证迭代时不会悄悄换掉正在玩的版本。
 */
import { registerSW } from 'virtual:pwa-register';

export interface PWAEvents {
  /** 检测到新版本，等待用户点击更新 */
  onUpdateReady: () => void;
  /** 首次安装完成，可离线游玩 */
  onOfflineReady: () => void;
}

export interface PWAHandle {
  /** 应用更新并刷新页面 */
  applyUpdate: () => void;
  /** 主动检查一次更新；返回是否有等待中的新版本 */
  checkUpdate: () => Promise<boolean>;
}

export function initPWA(events: PWAEvents): PWAHandle {
  let registration: ServiceWorkerRegistration | undefined;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      events.onUpdateReady();
    },
    onOfflineReady() {
      events.onOfflineReady();
    },
    onRegisteredSW(_swUrl, r) {
      registration = r;
      // 每小时静默检查一次；用户点「检查更新」也会立即触发
      if (r) setInterval(() => void r.update(), 60 * 60 * 1000);
    },
  });

  return {
    applyUpdate: () => void updateSW(true),
    checkUpdate: async () => {
      await registration?.update();
      // update() 后若出现 waiting，说明有新版本
      return !!registration?.waiting;
    },
  };
}
