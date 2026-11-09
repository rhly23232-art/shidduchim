import { useLayoutEffect, type RefObject } from 'react'

/** Keeps a CSS variable on <html> in sync with an element's height (for stacked sticky bars). */
export function useMeasureVar(ref: RefObject<HTMLElement | null>, cssVar: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const apply = () => root.style.setProperty(cssVar, `${el.offsetHeight}px`)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty(cssVar)
    }
  }, [ref, cssVar])
}
