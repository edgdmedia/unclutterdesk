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
        // On the app's own host, / and /pricing are the Desk home (src/edge/worker.ts),
        // not the app shell, so they always come from the network.
        navigateFallbackDenylist: [/^\/api(\/|$)/, /^\/(pricing\/?)?$/],
      },
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Therapysts',
        short_name: 'Therapysts',
        description: 'Mental health practice management platform',
        theme_color: '#2A56A8',
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
    // "Your session has expired". Production is one site under the tenant root domain.
    proxy: {
      '/v1': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:3099', changeOrigin: false },
    },
  },
});
