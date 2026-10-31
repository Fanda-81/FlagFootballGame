/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // 相对 base：便于部署到 GitHub Pages 子路径或任意静态目录
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
