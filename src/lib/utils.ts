import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/** tailwind-merge must know the design-system type scale, or it mistakes `text-h2` for a color. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display',
            'h1',
            'h2',
            'h3',
            'h4',
            'body-lg',
            'body',
            'body-sm',
            'caption',
            'label',
            'button',
            'table',
          ],
        },
      ],
      shadow: [{ shadow: ['sm', 'md', 'lg', 'none'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Trims; empty → null. */
export function emptyToNull(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

export function fullName(c: { first_name: string; last_name: string }): string {
  return `${c.first_name} ${c.last_name}`.trim()
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const NIKUD = /[֑-ׇ]/g
const PUNCT = /["'`׳״\-–—.,]/g
/** Normalizes Hebrew text for search: strips nikud, quotes/geresh, collapses whitespace. */
export function normalizeSearch(text: string): string {
  return text.replace(NIKUD, '').replace(PUNCT, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export const hebrewCollator = new Intl.Collator('he', { sensitivity: 'base', numeric: true })

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err && 'message' in err) return String(err.message)
  return String(err)
}
