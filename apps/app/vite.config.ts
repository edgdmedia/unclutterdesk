import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['unclutterdesk-mark.svg', 'unclutterdesk-lockup.svg'],
      manifest: {
        name: 'Unclutter Desk',
        short_name: 'Unclutter',
        description: 'Mental health practice management platform',
        theme_color: '#0F3A53',
        background_color: '#F8FAFC',
        display: 'standalone',
        icons: [
          {
            src: 'unclutterdesk-mark.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
  },
});
