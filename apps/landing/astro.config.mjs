// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // The same setting as src/config/domains.ts MARKETING_ORIGIN (spec §4.1a).
  site: (process.env.PUBLIC_MARKETING_URL || 'https://unclutterdesk.com').replace(/\/+$/, ''),

  integrations: [
    react(),
    sitemap(),
    AstroPWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Unclutter Desk',
        short_name: 'Unclutter',
        description: 'Mental health practice management platform',
        theme_color: '#0F3A53',
        background_color: '#F8FAFC',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],

  vite: {
    plugins: [tailwindcss()],
    server: {
      fs: {
        allow: ['../..']
      }
    }
  }
});