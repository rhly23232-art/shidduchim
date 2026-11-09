import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { dataApi } from '@/lib/api'
import { CLIENT_FILTER_LIMIT } from '@/lib/env'
import { he } from '@/lib/strings.he'
import {
  ACTIVE_STAGES,
  type CandidateRow,
  type IdeaInput,
  type Proposal,
  type ProposalInput,
  type TaskInput,
} from '@/lib/types'
import { errorMessage } from '@/lib/utils'
import { qk } from './useCandidates'

export const wk = {
  proposals: ['ws', 'proposals'] as const,
  events: (id: string) => ['ws', 'events', id] as const,
  recent: ['ws', 'recent'] as const,
  ideas: ['ws', 'ideas'] as const,
  tasks: ['ws', 'tasks'] as const,
  index: ['candidates', 'index'] as const,
}

/** Every candidate (both genders) — shared by the sidebar, proposals, matching and palette. */
export function useCandidateIndex() {
  const list = useQuery({
    queryKey: qk.list,
    queryFn: () => dataApi.listCandidates(CLIENT_FILTER_LIMIT),
    staleTime: 60_000,
  })
  const big = useQuery({
    queryKey: wk.index,
    queryFn: async () => (await dataApi.listCandidates(Number.MAX_SAFE_INTEGER)).rows,
    enabled: list.data?.overLimit === true,
    staleTime: 5 * 60_000,
  })
  const rows = list.data?.overLimit ? big.data : list.data?.rows
  const byId = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows])
  return {
    rows: rows ?? [],
    byId,
    isLoading: list.isPending || (list.data?.overLimit === true && big.isPending),
  }
}

export const useProposals = () =>
  useQuery({ queryKey: wk.proposals, queryFn: () => dataApi.listProposals(), staleTime: 30_000 })
export const useIdeas = () =>
  useQuery({ queryKey: wk.ideas, queryFn: () => dataApi.listIdeas(), staleTime: 30_000 })
export const useTasks = () =>
  useQuery({ queryKey: wk.tasks, queryFn: () => dataApi.listTasks(), staleTime: 30_000 })
export const useRecentEvents = () =>
  useQuery({ queryKey: wk.recent, queryFn: () => dataApi.listRecentEvents(12), staleTime: 30_000 })
export const useProposalEvents = (id: string | null) =>
  useQuery({
    queryKey: wk.events(id ?? ''),
    queryFn: () => dataApi.listProposalEvents(id!),
    enabled: !!id,
  })

const isActive = (p: Proposal) => ACTIVE_STAGES.includes(p.stage)

/**
 * Keeps candidate statuses in step with the pipeline:
 * בבירורים/בפגישות → "בתהליך", מזל טוב → "מאורס/ת", closing the last active proposal → back to "פעיל/ה".
 */
async function syncCandidateStatuses(
  p: Proposal,
  all: Proposal[],
  byId: Map<string, CandidateRow>,
): Promise<string | null> {
  const ids = [p.male_id, p.female_id]
  let target: 'in_process' | 'engaged' | 'active' | null = null
  if (p.stage === 'engaged') target = 'engaged'
  else if (p.stage === 'checking' || p.stage === 'meeting') target = 'in_process'
  else if (p.stage === 'closed') target = 'active'
  if (!target) return null
  let changed = false
  for (const id of ids) {
    const c = byId.get(id)
    if (!c || c.status === target) continue
    if (target === 'in_process' && c.status !== 'active') continue
    if (target === 'active') {
      if (c.status !== 'in_process') continue
      const stillBusy = all.some(
        (o) =>
          o.id !== p.id &&
          (o.male_id === id || o.female_id === id) &&
          (o.stage === 'checking' || o.stage === 'meeting'),
      )
      if (stillBusy) continue
    }
    await dataApi.setCandidateStatus(id, target)
    changed = true
  }
  return changed ? he.status[target] : null
}

export function useSaveProposal() {
  const qc = useQueryClient()
  const { byId } = useCandidateIndex()
  return useMutation({
    mutationFn: async ({ input, id }: { input: ProposalInput; id?: string }) => {
      const saved = await dataApi.saveProposal(input, id)
      const all = qc.getQueryData<Proposal[]>(wk.proposals) ?? []
      const synced = await syncCandidateStatuses(saved, all, byId)
      return { saved, synced }
    },
    onSuccess: async ({ saved, synced }) => {
      qc.setQueryData<Proposal[]>(wk.proposals, (old) => {
        if (!old) return old
        const rest = old.filter((p) => p.id !== saved.id)
        return [saved, ...rest]
      })
      if (synced) toast.message(he.proposals.statusSynced(synced))
      await Promise.all([
        qc.invalidateQueries({ queryKey: wk.proposals }),
        qc.invalidateQueries({ queryKey: wk.recent }),
        qc.invalidateQueries({ queryKey: wk.events(saved.id) }),
        synced ? qc.invalidateQueries({ queryKey: ['candidates'] }) : null,
        synced ? qc.invalidateQueries({ queryKey: ['candidate'] }) : null,
      ])
    },
  })
}

export function useDeleteProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dataApi.deleteProposal(id),
    onSuccess: async (_d, id) => {
      qc.setQueryData<Proposal[]>(wk.proposals, (old) => old?.filter((p) => p.id !== id))
      toast.success(he.proposals.deleted)
      await Promise.all([
        qc.invalidateQueries({ queryKey: wk.proposals }),
        qc.invalidateQueries({ queryKey: wk.recent }),
        qc.invalidateQueries({ queryKey: wk.tasks }),
      ])
    },
    onError: (e) => toast.error(he.common.unknownError, { description: errorMessage(e) }),
  })
}

export function useAddNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ proposalId, text }: { proposalId: string; text: string }) =>
      dataApi.addProposalNote(proposalId, text),
    onSuccess: async (_e, { proposalId }) => {
      toast.success(he.proposals.noteAdded)
      await Promise.all([
        qc.invalidateQueries({ queryKey: wk.events(proposalId) }),
        qc.invalidateQueries({ queryKey: wk.recent }),
        qc.invalidateQueries({ queryKey: wk.proposals }),
      ])
    },
    onError: (e) => toast.error(he.common.unknownError, { description: errorMessage(e) }),
  })
}

export function useSaveIdea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ input, id }: { input: IdeaInput; id?: string }) => dataApi.saveIdea(input, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: wk.ideas }),
    onError: (e) => toast.error(he.common.unknownError, { description: errorMessage(e) }),
  })
}
export function useDeleteIdea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dataApi.deleteIdea(id),
    onSuccess: () => {
      toast.success(he.ideas.deleted)
      return qc.invalidateQueries({ queryKey: wk.ideas })
    },
  })
}

export function useSaveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ input, id }: { input: TaskInput; id?: string }) => dataApi.saveTask(input, id),
    onMutate: async ({ input, id }) => {
      // optimistic toggle for instant checkbox feedback
      if (!id) return
      await qc.cancelQueries({ queryKey: wk.tasks })
      qc.setQueryData(wk.tasks, (old: { id: string }[] | undefined) =>
        old?.map((t) => (t.id === id ? { ...t, ...input } : t)),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: wk.tasks }),
    onError: (e) => toast.error(he.common.unknownError, { description: errorMessage(e) }),
  })
}
export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dataApi.deleteTask(id),
    onSuccess: () => {
      toast.success(he.tasks.deleted)
      return qc.invalidateQueries({ queryKey: wk.tasks })
    },
  })
}

export { isActive as isActiveProposal }
