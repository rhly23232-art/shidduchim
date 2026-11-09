import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const pushed = new Set<string>()

/**
 * A URL-backed overlay (?c=<candidate>, ?p=<proposal>): shareable, survives refresh, and
 * "Back" closes it when we opened it ourselves.
 */
export function useOverlayParam(key: string) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const value = params.get(key)

  const open = useCallback(
    (id: string) => {
      pushed.add(key)
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(key, id)
          return next
        },
        { replace: params.has(key) },
      )
    },
    [key, setParams, params],
  )

  const close = useCallback(() => {
    if (pushed.has(key) && window.history.length > 1) {
      pushed.delete(key)
      navigate(-1)
      return
    }
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(key)
        return next
      },
      { replace: true },
    )
  }, [key, navigate, setParams])

  return [value, open, close] as const
}
