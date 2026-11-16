import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { qk } from '@/hooks/useCandidates'
import { dataApi } from '@/lib/api'
import type { PhotoTarget } from '@/lib/api/types'
import { normalizePhoto } from '@/lib/files/image'
import { hostErrorCode, isHosted, saveViaHost } from '@/lib/hostBridge'
import { he } from '@/lib/strings.he'
import type { CandidateFull, CandidateRow, PhotoMeta } from '@/lib/types'
import { errorMessage } from '@/lib/utils'

// ---------- busy state per candidate (the row and the card show the same spinner) ----------
const busy = new Set<string>()
const subs = new Set<() => void>()
const setBusy = (id: string, on: boolean) => {
  if (on) busy.add(id)
  else busy.delete(id)
  subs.forEach((fn) => fn())
}
export function usePhotoBusy(candidateId: string): boolean {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => busy.has(candidateId),
  )
}

/** The photo as an object URL (cached per photo id; revoked when no longer shown). */
export function usePhotoUrl(photo: PhotoMeta | null | undefined): string | null {
  const q = useQuery({
    queryKey: ['photo', photo?.id],
    queryFn: () => dataApi.getPhotoBlob(photo!),
    enabled: !!photo,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  })
  // created and released by the same effect (safe under StrictMode's double run)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!q.data) return setUrl(null)
    const u = URL.createObjectURL(q.data)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [q.data])
  return url
}

export function usePhotoActions() {
  const qc = useQueryClient()

  const patchCaches = useCallback(
    (candidateId: string, photo: PhotoMeta | null) => {
      const patch = (r: CandidateRow) => (r.id === candidateId ? { ...r, photo } : r)
      qc.setQueryData<{ rows: CandidateRow[]; overLimit: boolean }>(qk.list, (old) =>
        old ? { ...old, rows: old.rows.map(patch) } : old,
      )
      qc.setQueryData<CandidateRow[]>(['candidates', 'index'], (old) => old?.map(patch))
      qc.setQueryData<CandidateFull | null>(qk.detail(candidateId), (old) =>
        old ? { ...old, photo } : old,
      )
      void qc.invalidateQueries({ queryKey: ['candidates', 'server'] })
    },
    [qc],
  )

  /** Any image file → JPEG → stored. Replaces the current photo. */
  const upload = useCallback(
    async (target: PhotoTarget, file: File) => {
      if (busy.has(target.id)) return
      setBusy(target.id, true)
      const toastId = toast.loading(he.photo.preparing, { description: file.name })
      try {
        const img = await normalizePhoto(file, {
          notImage: he.photo.notImage,
          tooLarge: he.photo.tooLarge,
          decode: he.photo.decode,
        })
        toast.loading(he.photo.uploading, { id: toastId, description: img.name })
        const meta = await dataApi.uploadPhoto(target, img.blob, img.name, () => {})
        qc.setQueryData(['photo', meta.id], img.blob)
        patchCaches(target.id, meta)
        toast.success(he.photo.uploaded, { id: toastId, description: img.name })
      } catch (err) {
        toast.error(he.photo.uploadFailed, { id: toastId, description: errorMessage(err) })
      } finally {
        setBusy(target.id, false)
      }
    },
    [patchCaches, qc],
  )

  const remove = useCallback(
    async (photo: PhotoMeta) => {
      try {
        await dataApi.deletePhoto(photo)
        patchCaches(photo.candidate_id, null)
        toast.success(he.photo.deleted)
      } catch (err) {
        toast.error(he.photo.deleteFailed, { description: errorMessage(err) })
      }
    },
    [patchCaches],
  )

  const download = useCallback(async (photo: PhotoMeta) => {
    try {
      const blob = await dataApi.getPhotoBlob(photo)
      if (isHosted() && (await saveViaHost(photo.file_name, blob))) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = photo.file_name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      if (hostErrorCode(err) === 'declined') return
      toast.error(he.photo.loadFailed, { description: errorMessage(err) })
    }
  }, [])

  return { upload, remove, download }
}
