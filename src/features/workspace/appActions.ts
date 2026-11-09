import { createContext, useContext } from 'react'
import type { CandidateFull, CandidateRow, Gender } from '@/lib/types'

export interface AppActions {
  openCandidate: (id: string) => void
  newCandidate: (gender?: Gender) => void
  editCandidate: (c: CandidateFull | CandidateRow) => void
  deleteCandidate: (c: CandidateRow) => void
  openPalette: () => void
}

export const AppActionsContext = createContext<AppActions | null>(null)

export function useAppActions(): AppActions {
  const ctx = useContext(AppActionsContext)
  if (!ctx) throw new Error('useAppActions must be used inside AppShell')
  return ctx
}
