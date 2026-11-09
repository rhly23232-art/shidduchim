/**
 * Categorical palette (see docs/DESIGN_SYSTEM.md §2.1). Full class names are listed
 * literally so Tailwind can see them. Use a tint to give an *area* or a *person* an identity —
 * never to carry status meaning (that is what success/warning/destructive/info are for).
 */
export const TINTS = {
  blue: {
    bg: 'bg-tint-blue',
    fg: 'text-tint-blue-fg',
    strong: 'bg-tint-blue-strong',
    border: 'border-tint-blue-strong/40',
    hoverBorder: 'hover:border-tint-blue-strong/60',
    wash: 'from-tint-blue',
  },
  violet: {
    bg: 'bg-tint-violet',
    fg: 'text-tint-violet-fg',
    strong: 'bg-tint-violet-strong',
    border: 'border-tint-violet-strong/40',
    hoverBorder: 'hover:border-tint-violet-strong/60',
    wash: 'from-tint-violet',
  },
  teal: {
    bg: 'bg-tint-teal',
    fg: 'text-tint-teal-fg',
    strong: 'bg-tint-teal-strong',
    border: 'border-tint-teal-strong/40',
    hoverBorder: 'hover:border-tint-teal-strong/60',
    wash: 'from-tint-teal',
  },
  amber: {
    bg: 'bg-tint-amber',
    fg: 'text-tint-amber-fg',
    strong: 'bg-tint-amber-strong',
    border: 'border-tint-amber-strong/40',
    hoverBorder: 'hover:border-tint-amber-strong/60',
    wash: 'from-tint-amber',
  },
  rose: {
    bg: 'bg-tint-rose',
    fg: 'text-tint-rose-fg',
    strong: 'bg-tint-rose-strong',
    border: 'border-tint-rose-strong/40',
    hoverBorder: 'hover:border-tint-rose-strong/60',
    wash: 'from-tint-rose',
  },
  green: {
    bg: 'bg-tint-green',
    fg: 'text-tint-green-fg',
    strong: 'bg-tint-green-strong',
    border: 'border-tint-green-strong/40',
    hoverBorder: 'hover:border-tint-green-strong/60',
    wash: 'from-tint-green',
  },
  sky: {
    bg: 'bg-tint-sky',
    fg: 'text-tint-sky-fg',
    strong: 'bg-tint-sky-strong',
    border: 'border-tint-sky-strong/40',
    hoverBorder: 'hover:border-tint-sky-strong/60',
    wash: 'from-tint-sky',
  },
} as const

export type TintName = keyof typeof TINTS
export const TINT_NAMES = Object.keys(TINTS) as TintName[]

/** Fixed color per area of the app — the same everywhere (sidebar, home, headers). */
export const AREA_TINT = {
  home: 'sky',
  male: 'blue',
  female: 'violet',
  all: 'teal',
  ideas: 'amber',
} as const satisfies Record<string, TintName>

/** Stable color for a person (by id), so the same candidate always looks the same. */
export function tintFor(key: string): TintName {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return TINT_NAMES[Math.abs(h) % TINT_NAMES.length]!
}

/** Hebrew initials: first letter of the first and last word ("יוסף כהן" → "יכ"). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  const first = words[0]!.charAt(0)
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : ''
  return first + last
}
