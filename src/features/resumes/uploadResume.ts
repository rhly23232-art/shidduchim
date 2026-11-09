import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { qk } from '@/hooks/useCandidates'
import { dataApi, type UploadTarget } from '@/lib/api'
import { he } from '@/lib/strings.he'
import type { CandidateFull, CandidateRow, ResumeMeta } from '@/lib/types'
import { errorMessage } from '@/lib/utils'
import { validateResumeFile } from '@/lib/validators'
import { hostErrorCode, isHosted, saveViaHost } from '@/lib/hostBridge'
import { openResumeViewer } from './viewerStore'

// ---------- shared upload-progress store (row + modal show the same progress) -----
const progress = new Map<string, number>()
const subscribers = new Set<() => void>()
const notify = () => subscribers.forEach((fn) => fn())
const setProgress = (id: string, pct: number | null) => {
  if (pct === null) progress.delete(id)
  else progress.set(id, pct)
  notify()
}
const subscribe = (fn: () => void) => {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

/** Upload progress 0–100 for a candidate, or null when idle. */
export function useUploadProgress(candidateId: string): number | null {
  return useSyncExternalStore(subscribe, () => progress.get(candidateId) ?? null)
}

/** Validates a picked file; shows a toast and returns null when rejected. */
export async function checkResumeFile(file: File): Promise<string | null> {
  const res = await validateResumeFile(file)
  if (!res.ok) {
    toast.error(res.error, { description: he.resume.accepted })
    return null
  }
  return res.mime
}

export function useResumeActions() {
  const qc = useQueryClient()

  const patchCaches = useCallback(
    (candidateId: string, resume: ResumeMeta | null) => {
      qc.setQueryData<{ rows: CandidateRow[]; overLimit: boolean }>(qk.list, (old) =>
        old
          ? { ...old, rows: old.rows.map((r) => (r.id === candidateId ? { ...r, resume } : r)) }
          : old,
      )
      qc.setQueryData<CandidateFull | null>(qk.detail(candidateId), (old) =>
        old ? { ...old, resume } : old,
      )
      void qc.invalidateQueries({ queryKey: ['candidates', 'server'] })
    },
    [qc],
  )

  const upload = useCallback(
    async (target: UploadTarget, file: File, mime: string) => {
      if (progress.has(target.id)) return
      setProgress(target.id, 0)
      const toastId = toast.loading(he.resume.uploading(0), { description: file.name })
      try {
        const meta = await dataApi.uploadResume(target, file, mime, (pct) => {
          setProgress(target.id, pct)
          toast.loading(he.resume.uploading(pct), { id: toastId, description: file.name })
        })
        patchCaches(target.id, meta)
        toast.success(he.resume.uploaded, { id: toastId, description: file.name })
      } catch (err) {
        toast.error(he.resume.uploadFailed, { id: toastId, description: errorMessage(err) })
      } finally {
        setProgress(target.id, null)
      }
    },
    [patchCaches],
  )

  const remove = useCallback(
    async (resume: ResumeMeta) => {
      try {
        await dataApi.deleteResume(resume)
        patchCaches(resume.candidate_id, null)
        toast.success(he.resume.deleted)
      } catch (err) {
        toast.error(he.resume.deleteFailed, { description: errorMessage(err) })
      }
    },
    [patchCaches],
  )

  const download = useCallback(async (resume: ResumeMeta) => {
    try {
      if (isHosted()) {
        // Inside the claude.ai viewer direct downloads are blocked — use its save dialog.
        const blob = await dataApi.getResumeBlob(resume)
        if (await saveViaHost(resume.file_name, blob)) {
          toast.success(he.resume.downloadStarted, { description: resume.file_name })
          return
        }
      }
      // Short-lived signed URL (60s).
      const url = await dataApi.getResumeUrl(resume, { download: true, expiresIn: 60 })
      const a = document.createElement('a')
      a.href = url
      a.download = resume.file_name
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      toast.success(he.resume.downloadStarted, { description: resume.file_name })
    } catch (err) {
      if (hostErrorCode(err) === 'declined') return
      toast.error(he.resume.downloadFailed, { description: errorMessage(err) })
    }
  }, [])

  /** Opens the in-app viewer (works everywhere — no new tab needed). */
  const view = useCallback((resume: ResumeMeta, title?: string) => {
    openResumeViewer(resume, title ?? resume.file_name)
  }, [])

  return { upload, remove, download, view }
}

export const isViewable = (mime: string) =>
  mime === 'application/pdf' || mime.startsWith('image/') || mime.includes('wordprocessingml')
