import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { dataApi, type CandidateFilters, type SortState } from '@/lib/api'
import { CLIENT_FILTER_LIMIT } from '@/lib/env'
import type { CandidateRow, SaveCandidatePayload, TabKey } from '@/lib/types'
import {
  buildFacets,
  filterCandidates,
  sortCandidates,
  type FacetOptions,
} from '@/features/candidates/filtering'

export const qk = {
  all: ['candidates'] as const,
  list: ['candidates', 'list'] as const,
  counts: ['candidates', 'counts'] as const,
  server: (g: TabKey, f: CandidateFilters, s: SortState) =>
    ['candidates', 'server', g, f, s] as const,
  facets: (g: TabKey) => ['candidates', 'facets', g] as const,
  detail: (id: string) => ['candidate', id] as const,
}

const SERVER_PAGE = 500

export interface CandidateDataset {
  mode: 'client' | 'server'
  rows: CandidateRow[]
  /** Number of rows matching the filters (server mode may return fewer). */
  matched: number
  /** Rows of the current gender before filters (for "X מתוך Y"). */
  genderTotal: number
  counts: { male: number; female: number } | undefined
  facets: FacetOptions
  /** Server mode only: more matches exist than were returned. */
  capped: boolean
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  refetch: () => void
}

const EMPTY_FACETS: FacetOptions = { cities: [], regions: [], institutions: [] }

/**
 * ≤ 5,000 rows: one cached list, filtered & sorted instantly on the client.
 * Larger accounts automatically switch to server-side filtering.
 */
export function useCandidateDataset(
  gender: TabKey,
  filters: CandidateFilters,
  sort: SortState,
): CandidateDataset {
  const list = useQuery({
    queryKey: qk.list,
    queryFn: () => dataApi.listCandidates(CLIENT_FILTER_LIMIT),
    staleTime: 60_000,
  })
  const serverMode = list.data?.overLimit === true

  const counts = useQuery({
    queryKey: qk.counts,
    queryFn: () => dataApi.countCandidates(),
    enabled: serverMode,
  })
  const server = useQuery({
    queryKey: qk.server(gender, filters, sort),
    queryFn: () => dataApi.queryCandidates(gender, filters, sort, SERVER_PAGE),
    enabled: serverMode,
    placeholderData: keepPreviousData,
  })
  const facetRows = useQuery({
    queryKey: qk.facets(gender),
    queryFn: () => dataApi.listFacets(gender),
    enabled: serverMode,
    staleTime: 5 * 60_000,
  })

  const allRows = list.data?.rows
  const clientCounts = useMemo(() => {
    if (!allRows) return undefined
    let male = 0
    for (const r of allRows) if (r.gender === 'male') male++
    return { male, female: allRows.length - male }
  }, [allRows])

  const genderRows = useMemo(
    () => allRows?.filter((r) => gender === 'all' || r.gender === gender) ?? [],
    [allRows, gender],
  )
  const clientFacets = useMemo(() => buildFacets(genderRows), [genderRows])
  const clientRows = useMemo(
    () => sortCandidates(filterCandidates(genderRows, gender, filters), sort),
    [genderRows, gender, filters, sort],
  )
  const serverFacets = useMemo(
    () => (facetRows.data ? buildFacets(facetRows.data) : EMPTY_FACETS),
    [facetRows.data],
  )

  if (!serverMode) {
    return {
      mode: 'client',
      rows: clientRows,
      matched: clientRows.length,
      genderTotal: genderRows.length,
      counts: clientCounts,
      facets: clientFacets,
      capped: false,
      isLoading: list.isPending,
      isFetching: list.isFetching,
      isError: list.isError,
      refetch: () => void list.refetch(),
    }
  }
  return {
    mode: 'server',
    rows: server.data?.rows ?? [],
    matched: server.data?.total ?? 0,
    genderTotal: counts.data
      ? gender === 'all'
        ? counts.data.male + counts.data.female
        : counts.data[gender]
      : 0,
    counts: counts.data,
    facets: serverFacets,
    capped: (server.data?.total ?? 0) > (server.data?.rows.length ?? 0),
    isLoading: server.isPending || counts.isPending,
    isFetching: server.isFetching,
    isError: server.isError || counts.isError,
    refetch: () => {
      void server.refetch()
      void counts.refetch()
    },
  }
}

export function useCandidateDetail(id: string | null) {
  return useQuery({
    queryKey: qk.detail(id ?? ''),
    queryFn: () => dataApi.getCandidate(id!),
    enabled: !!id,
  })
}

export function useSaveCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SaveCandidatePayload) => dataApi.saveCandidate(payload),
    onSuccess: async (id) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.all }),
        qc.invalidateQueries({ queryKey: qk.detail(id) }),
      ])
    },
  })
}

export function useDeleteCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dataApi.deleteCandidate(id),
    onSuccess: async (_d, id) => {
      // Optimistically drop from the cached list for an instant UI.
      qc.setQueryData<{ rows: CandidateRow[]; overLimit: boolean }>(qk.list, (old) =>
        old ? { ...old, rows: old.rows.filter((r) => r.id !== id) } : old,
      )
      qc.removeQueries({ queryKey: qk.detail(id) })
      await qc.invalidateQueries({ queryKey: qk.all })
    },
  })
}
