/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,astro}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          'primary-hover': 'var(--brand-primary-hover)',
          'primary-soft': 'var(--brand-primary-soft)',
          'on-primary': 'var(--brand-on-primary)',
          secondary: 'var(--brand-secondary)',
          'secondary-hover': 'var(--brand-secondary-hover)',
          'secondary-soft': 'var(--brand-secondary-soft)',
          'on-secondary': 'var(--brand-on-secondary)',
          ring: 'var(--brand-ring)',
          tint: 'var(--brand-tint)',
          fill: 'var(--brand-fill)',
          dot: 'var(--brand-dot)',
          bar: 'var(--brand-bar)',
        },
        desk: {
          pine: {
            900: 'var(--desk-pine-900)',
            800: 'var(--desk-pine-800)',
            700: 'var(--desk-pine-700)',
            600: 'var(--desk-pine-600)',
            500: 'var(--desk-pine-500)',
            400: 'var(--desk-pine-400)',
            300: 'var(--desk-pine-300)',
            200: 'var(--desk-pine-200)',
            100: 'var(--desk-pine-100)',
            50: 'var(--desk-pine-050)',
          },
          clay: {
            700: 'var(--desk-clay-700)',
            600: 'var(--desk-clay-600)',
            100: 'var(--desk-clay-100)',
          },
          sidebar: {
            DEFAULT: 'var(--desk-sidebar)',
            hover: 'var(--desk-sidebar-hover)',
            active: 'var(--desk-sidebar-active)',
          },
          surface: {
            DEFAULT: 'var(--desk-surface)',
            alt: 'var(--desk-surface-alt)',
            muted: 'var(--desk-surface-muted)',
          },
          canvas: 'var(--desk-canvas)',
          card: 'var(--desk-card)',
          border: {
            DEFAULT: 'var(--desk-border)',
            soft: 'var(--desk-border-soft)',
            strong: 'var(--desk-border-strong)',
          },
          text: {
            DEFAULT: 'var(--desk-text)',
            body: 'var(--desk-text-body)',
            muted: 'var(--desk-text-muted)',
            subtle: 'var(--desk-text-subtle)',
            invert: 'var(--desk-text-invert)',
          },
          active: {
            DEFAULT: 'var(--desk-active)',
            dot: 'var(--desk-active-dot)',
            bg: 'var(--desk-active-bg)',
            border: 'var(--desk-active-border)',
          },
          pending: {
            DEFAULT: 'var(--desk-pending)',
            dot: 'var(--desk-pending-dot)',
            bg: 'var(--desk-pending-bg)',
            border: 'var(--desk-pending-border)',
          },
          inactive: {
            DEFAULT: 'var(--desk-inactive)',
            bg: 'var(--desk-inactive-bg)',
            border: 'var(--desk-inactive-border)',
          },
          danger: {
            DEFAULT: 'var(--desk-danger)',
            bg: 'var(--desk-danger-bg)',
            border: 'var(--desk-danger-border)',
          },
          info: {
            DEFAULT: 'var(--desk-info)',
            bg: 'var(--desk-info-bg)',
            border: 'var(--desk-info-border)',
          },
        },
      },
    },
  },
  plugins: [],
};
