import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Maison de Luxe POS',
        short_name: 'MDL POS',
        description: 'Offline-first point of sale for Maison de Luxe',
        theme_color: '#131313',
        background_color: '#131313',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precaches the hashed app shell so the POS opens with zero network
        // after the first visit. Images stay out of the precache (some logos
        // exceed the 2 MiB default cap) and are handled by the runtime
        // CacheFirst rule below instead.
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,webmanifest}'],
        globIgnores: ['**/assets/images/**'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              url.pathname.startsWith('/assets/images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mdl-menu-images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 3600,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});