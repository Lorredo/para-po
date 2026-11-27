import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // We show our own "update ready" prompt, and never reload mid-trip.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Para Po',
        short_name: 'Para Po',
        description:
          'A destination alarm for jeepney, bus and train commuters. Your stop, never missed.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FAF7F2',
        theme_color: '#0B3C5D',
        categories: ['travel', 'navigation', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The app shell: code, styles, fonts, icons. Sounds are synthesised,
        // so there are no audio files to cache.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Map tiles and search are deliberately NOT cached by the service
        // worker: OpenStreetMap's policies discourage it. The browser's
        // normal HTTP cache still applies.
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
      thresholds: {
        // The geometry and "when to ring" logic must stay fully tested.
        'src/lib/geo/**/*.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
})
