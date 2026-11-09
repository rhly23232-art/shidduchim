import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1440px' } },
    extend: {
      colors: {
        navy: {
          50: token('navy-50'),
          100: token('navy-100'),
          200: token('navy-200'),
          700: token('navy-700'),
          800: token('navy-800'),
          900: token('navy-900'),
        },
        gold: {
          100: token('gold-100'),
          300: token('gold-300'),
          500: token('gold-500'),
          700: token('gold-700'),
        },
        cream: { 50: token('cream-50'), 100: token('cream-100') },
        surface: token('surface'),
        ink: { DEFAULT: token('ink'), muted: token('ink-muted') },
        line: token('line'),
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        success: { DEFAULT: token('success'), soft: token('success-soft') },
        warning: { DEFAULT: token('warning'), soft: token('warning-soft') },
        // shadcn semantic aliases
        background: token('cream-50'),
        foreground: token('ink'),
        border: token('line'),
        input: token('line'),
        ring: token('gold-500'),
        primary: { DEFAULT: token('navy-900'), foreground: token('surface') },
        muted: { DEFAULT: token('cream-100'), foreground: token('ink-muted') },
        accent: { DEFAULT: token('navy-50'), foreground: token('navy-900') },
        popover: { DEFAULT: token('surface'), foreground: token('ink') },
      },
      fontFamily: {
        heading: ['"Frank Ruhl Libre"', 'Georgia', 'serif'],
        sans: ['Heebo', 'system-ui', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        pop: 'var(--shadow-pop)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      transitionTimingFunction: { out: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(-100%)' } },
      },
      animation: { shimmer: 'shimmer 1.4s infinite' },
    },
  },
  plugins: [animate],
} satisfies Config
