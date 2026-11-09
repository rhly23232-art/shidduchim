import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { dataApi } from '@/lib/api'
import { CLIENT_FILTER_LIMIT } from '@/lib/env'
import { he } from '@/lib/strings.he'
import type { IdeaInput } from '@/lib/types'
import { errorMessage } from '@/lib/utils'
import { qk } from './useCandidates'

export const wk = {
  ideas: ['ws', 'ideas'] as const,
  index: ['candidates', 'index'] as const,
}

/** Every candidate (both genders) — shared by the sidebar, ideas and the quick-search palette. */
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

export const useIdeas = () =>
  useQuery({ queryKey: wk.ideas, queryFn: () => dataApi.listIdeas(), staleTime: 30_000 })

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
    onError: (e) => toast.error(he.common.unknownError, { description: errorMessage(e) }),
  })
}
