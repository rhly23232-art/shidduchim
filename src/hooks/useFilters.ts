import { useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { CandidateFilters, SortKey, SortState } from '@/lib/api'
import { AGE_MAX, AGE_MIN } from '@/lib/age'
import type { Gender } from '@/lib/types'

const SORT_KEYS: SortKey[] = ['name', 'age', 'city', 'institution', 'occupation', 'updated']
export const DEFAULT_SORT: SortState = { key: 'updated', dir: 'desc' }

const clampAge = (raw: string | null, fallback: number) => {
  const n = raw === null ? NaN : Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(AGE_MAX, Math.max(AGE_MIN, Math.round(n)))
}

let openedViaPush = false

export type ListKey = 'cities' | 'regions' | 'institutions' | 'communities'
const LIST_PARAM: Record<ListKey, string> = {
  cities: 'city',
  regions: 'region',
  institutions: 'inst',
  communities: 'comm',
}

/**
 * All dashboard state that should be shareable lives in the URL:
 * ?tab=male|female&q=&ageMin=&ageMax=&city=…&region=…&inst=…&comm=…&sort=-age&c=<candidateId>
 */
export function useFilters() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const gender: Gender = params.get('tab') === 'female' ? 'female' : 'male'

  const filters = useMemo<CandidateFilters>(() => {
    let ageMin = clampAge(params.get('ageMin'), AGE_MIN)
    let ageMax = clampAge(params.get('ageMax'), AGE_MAX)
    if (ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin]
    const list = (k: string) => [...new Set(params.getAll(k).filter(Boolean))]
    return {
      q: params.get('q') ?? '',
      ageMin,
      ageMax,
      cities: list('city'),
      regions: list('region'),
      institutions: list('inst'),
      communities: list('comm'),
    }
  }, [params])

  const sort = useMemo<SortState>(() => {
    const raw = params.get('sort')
    if (!raw) return DEFAULT_SORT
    const dir = raw.startsWith('-') ? 'desc' : 'asc'
    const key = raw.replace(/^-/, '') as SortKey
    return SORT_KEYS.includes(key) ? { key, dir } : DEFAULT_SORT
  }, [params])

  const openId = params.get('c')

  const update = useCallback(
    (mutate: (p: URLSearchParams) => void, opts?: { push?: boolean }) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutate(next)
          return next
        },
        { replace: !opts?.push },
      )
    },
    [setParams],
  )

  const setGender = useCallback(
    (g: Gender) =>
      update((p) => {
        if (g === 'male') p.delete('tab')
        else p.set('tab', g)
        p.delete('inst') // yeshivot ≠ seminaries
        if (
          p.get('sort')?.replace('-', '') === 'occupation' ||
          p.get('sort')?.replace('-', '') === 'institution'
        )
          p.delete('sort')
      }),
    [update],
  )

  const setQuery = useCallback(
    (q: string) =>
      update((p) => {
        if (q.trim()) p.set('q', q)
        else p.delete('q')
      }),
    [update],
  )

  const setAge = useCallback(
    (min: number, max: number) =>
      update((p) => {
        const lo = Math.min(min, max)
        const hi = Math.max(min, max)
        if (lo > AGE_MIN) p.set('ageMin', String(lo))
        else p.delete('ageMin')
        if (hi < AGE_MAX) p.set('ageMax', String(hi))
        else p.delete('ageMax')
      }),
    [update],
  )

  const setList = useCallback(
    (key: ListKey, values: string[]) =>
      update((p) => {
        const name = LIST_PARAM[key]
        p.delete(name)
        values.forEach((v) => p.append(name, v))
      }),
    [update],
  )

  const setSort = useCallback(
    (s: SortState | null) =>
      update((p) => {
        if (!s || (s.key === DEFAULT_SORT.key && s.dir === DEFAULT_SORT.dir)) p.delete('sort')
        else p.set('sort', `${s.dir === 'desc' ? '-' : ''}${s.key}`)
      }),
    [update],
  )

  const resetFilters = useCallback(
    () =>
      update((p) => {
        ;['q', 'ageMin', 'ageMax', 'city', 'region', 'inst', 'comm'].forEach((k) => p.delete(k))
      }),
    [update],
  )

  const openCandidate = useCallback(
    (id: string) => {
      openedViaPush = true
      update((p) => p.set('c', id), { push: true })
    },
    [update],
  )

  /** Switch to a gender tab and open a candidate in one navigation (e.g. after create). */
  const showCandidate = useCallback(
    (id: string, g: Gender) => {
      openedViaPush = true
      update(
        (p) => {
          if (g === 'male') p.delete('tab')
          else p.set('tab', g)
          if ((p.get('tab') ?? 'male') !== (params.get('tab') ?? 'male')) p.delete('inst')
          p.set('c', id)
        },
        { push: true },
      )
    },
    [update, params],
  )

  /** Closing pops the history entry we pushed (so "Back" on mobile closes the modal). */
  const closeCandidate = useCallback(() => {
    if (openedViaPush && window.history.length > 1) {
      openedViaPush = false
      navigate(-1)
    } else {
      update((p) => p.delete('c'))
    }
  }, [navigate, update])

  const activeCount =
    (filters.q ? 1 : 0) +
    (filters.ageMin > AGE_MIN || filters.ageMax < AGE_MAX ? 1 : 0) +
    filters.cities.length +
    filters.regions.length +
    filters.institutions.length +
    filters.communities.length

  return {
    gender,
    filters,
    sort,
    openId,
    activeCount,
    setGender,
    setQuery,
    setAge,
    setList,
    setSort,
    resetFilters,
    openCandidate,
    closeCandidate,
    showCandidate,
  }
}

export type FiltersApi = ReturnType<typeof useFilters>
