import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
  },
});
