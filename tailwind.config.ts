import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

/**
 * Design tokens — "Calm Productivity".
 * Every color, size, radius and shadow used in the app comes from here
 * (values live as CSS variables in src/index.css). See docs/DESIGN_SYSTEM.md.
 */
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1440px' } },
    // Breakpoints (Tailwind defaults, documented): sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536
    fontFamily: {
      sans: ['Heebo', 'system-ui', 'Arial', 'sans-serif'],
    },
    // Type scale — replaces Tailwind's defaults so no ad-hoc sizes can sneak in.
    fontSize: {
      display: ['2rem', { lineHeight: '2.5rem', fontWeight: '700', letterSpacing: '-0.01em' }],
      h1: ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],
      h2: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
      h3: ['1.125rem', { lineHeight: '1.625rem', fontWeight: '600' }],
      h4: ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
      'body-lg': ['1rem', { lineHeight: '1.625rem' }],
      body: ['0.875rem', { lineHeight: '1.375rem' }],
      'body-sm': ['0.8125rem', { lineHeight: '1.25rem' }],
      caption: ['0.75rem', { lineHeight: '1rem' }],
      label: ['0.8125rem', { lineHeight: '1.25rem', fontWeight: '500' }],
      button: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
      table: ['0.875rem', { lineHeight: '1.25rem' }],
    },
    borderRadius: {
      none: '0',
      sm: 'var(--radius-sm)',
      DEFAULT: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      sm: 'var(--shadow-sm)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
    },
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        card: { DEFAULT: token('card'), foreground: token('foreground') },
        popover: { DEFAULT: token('card'), foreground: token('foreground') },
        primary: {
          DEFAULT: token('primary'),
          hover: token('primary-hover'),
          foreground: token('primary-foreground'),
        },
        secondary: {
          DEFAULT: token('secondary'),
          hover: token('secondary-hover'),
          foreground: token('foreground'),
        },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        brand: token('brand'),
        destructive: {
          DEFAULT: token('destructive'),
          hover: token('destructive-hover'),
          foreground: token('primary-foreground'),
          soft: token('destructive-soft'),
        },
        success: { DEFAULT: token('success'), soft: token('success-soft') },
        warning: {
          DEFAULT: token('warning'),
          soft: token('warning-soft'),
          dot: token('warning-dot'),
        },
        info: { DEFAULT: token('info'), soft: token('info-soft') },
        border: token('border'),
        input: { DEFAULT: token('input'), hover: token('input-hover') },
        ring: token('ring'),
        overlay: token('overlay'),
      },
      transitionDuration: { fast: '150ms', base: '200ms', slow: '250ms' },
      transitionTimingFunction: { out: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(-100%)' } },
      },
      animation: { shimmer: 'shimmer 1.4s infinite' },
    },
  },
  plugins: [animate],
} satisfies Config
