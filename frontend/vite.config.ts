import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3002';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.ico'],
      manifest: {
        name: 'Auftragsverwaltung',
        short_name: 'Aufträge',
        description: 'Maschinenkonfiguration & Auftragsverwaltung',
        theme_color: '#2563eb',
        background_color: '#f9fafb',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/machine-models/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'api-machine-models', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /^\/api\/accessories/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'api-accessories', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /^\/api\/machine-requests/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-machine-requests',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^\/api\/uploads\/files\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
