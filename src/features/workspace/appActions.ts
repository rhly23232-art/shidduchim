import { createContext, useContext } from 'react'
import type { CandidateFull, CandidateRow, Gender } from '@/lib/types'

export interface NewProposalPrefill {
  male_id?: string
  female_id?: string
  notes?: string
  /** When created from an idea, the idea is marked done. */
  ideaId?: string
}

export interface AppActions {
  openCandidate: (id: string) => void
  newCandidate: (gender?: Gender) => void
  editCandidate: (c: CandidateFull | CandidateRow) => void
  deleteCandidate: (c: CandidateRow) => void
  openProposal: (id: string) => void
  newProposal: (prefill?: NewProposalPrefill) => void
  openPalette: () => void
}

export const AppActionsContext = createContext<AppActions | null>(null)

export function useAppActions(): AppActions {
  const ctx = useContext(AppActionsContext)
  if (!ctx) throw new Error('useAppActions must be used inside AppShell')
  return ctx
}
