import { useSyncExternalStore } from 'react'
import type { ResumeMeta } from '@/lib/types'

interface ViewerState {
  resume: ResumeMeta
  title: string
}
let state: ViewerState | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export function openResumeViewer(resume: ResumeMeta, title: string) {
  state = { resume, title }
  emit()
}
export function closeResumeViewer() {
  state = null
  emit()
}
export function useResumeViewer(): ViewerState | null {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
  )
}
