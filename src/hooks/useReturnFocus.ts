import { useRef } from 'react'

/**
 * Radix dialogs return focus to their <Trigger>. Our dialogs are often opened from state
 * (row buttons, URL deep links) without a Trigger, so remember whatever had focus when the
 * dialog opened and restore it on close (WCAG 2.4.3 focus order).
 */
export function useReturnFocus<E extends { preventDefault: () => void; defaultPrevented: boolean }>(
  onOpen?: (e: E) => void,
  onClose?: (e: E) => void,
) {
  const ref = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: (e: E) => {
      const active = document.activeElement
      ref.current = active instanceof HTMLElement && active !== document.body ? active : null
      onOpen?.(e)
    },
    onCloseAutoFocus: (e: E) => {
      onClose?.(e)
      if (e.defaultPrevented) return
      const el = ref.current
      if (el && el.isConnected) {
        e.preventDefault()
        el.focus({ preventScroll: true })
      }
    },
  }
}
