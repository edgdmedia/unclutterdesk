import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // On a practice's custom domain the client API is served at /api by
        // the tenant router (spec §6.16). A link that opens an /api address
        // (an iCal download, say) must reach it, not the app's index.html.
        navigateFallbackDenylist: [/^\/api(\/|$)/],
      },
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'unclutterdesk-mark.svg', 'unclutterdesk-lockup.svg'],
      manifest: {
        name: 'Unclutter Desk',
        short_name: 'Unclutter',
        description: 'Mental health practice management platform',
        theme_color: '#1C4E3F',
        background_color: '#F8FAFC',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ]
      }
    })
  ],
  server: {
    port: 5173,
    // In development the API is reached through this server, so every page
    // (app.localhost, a practice's *.localhost booking host) talks to it on its
    // own origin. Calling the API on another *.localhost host is cross-site:
    // the browser drops the session and CSRF cookies, and booking failed with
    // "Your session has expired". Production is one site under unclutterdesk.com.
    proxy: {
      '/v1': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:3099', changeOrigin: false },
    },
  },
});
