import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const tourism = JSON.parse(readFileSync(new URL('./public/data/tourism.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version), __TOURISM_METADATA__: JSON.stringify({ count: tourism.places.length, fetchedAt: tourism.fetchedAt }) },
  root: 'web',
  publicDir: '../public',
  build: { outDir: '../dist', emptyOutDir: true },
  test: { root: '.', include: ['src/**/*.test.{ts,tsx}'] },
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    strategies: 'injectManifest',
    srcDir: '../src',
    filename: 'sw.js',
    injectRegister: false,
    manifest: {
      name: 'Fietsroutes Vlaanderen', short_name: 'Fietsroutes', lang: 'nl-BE',
      description: 'Plan en fiets langs de officiële Vlaamse fietsknooppunten.',
      theme_color: '#073b32', background_color: '#f3f6f5', display: 'standalone',
      icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,svg,json}'], maximumFileSizeToCacheInBytes: 20000000,
    },
  })],
});

