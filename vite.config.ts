/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

export default defineConfig({
  // 相对 base：便于部署到 GitHub Pages 子路径或任意静态目录
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    VitePWA({
      // prompt：检测到新版本时由页面弹「立即更新」，用户点一下才切换
      registerType: 'prompt',
      // 注册逻辑在 src/pwa.ts（virtual:pwa-register），不额外注入 registerSW.js
      injectRegister: false,
      includeAssets: ['icons/favicon-64.png', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'FFSimu — 腰旗橄榄球传球训练',
        short_name: 'FFSimu',
        description: '腰旗橄榄球传球训练：Madden 风格战术 + 纵向 3D 球场，长按平快球、轻点高球',
        theme_color: '#0b3d1f',
        background_color: '#070b14',
        display: 'standalone',
        orientation: 'landscape',
        lang: 'zh-CN',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 代码/图标/模型都进预缓存：SW 安装完即离线可用（模型 ≤2MB，一次下载）
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,glb}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // 新 SW 激活后接管页面，保证点「立即更新」后一定能刷新到新版本
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            urlPattern: /\/models\/.*\.(glb|gltf|bin|ktx2|draco)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ffp-models',
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
