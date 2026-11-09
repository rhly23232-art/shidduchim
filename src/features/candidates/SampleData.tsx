import { useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useCandidateIndex } from '@/hooks/useWorkspace'
import { dataApi } from '@/lib/api'
import { he } from '@/lib/strings.he'
import { errorMessage } from '@/lib/utils'

function useRefreshAll() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['candidates'] }),
      qc.invalidateQueries({ queryKey: ['candidate'] }),
      qc.invalidateQueries({ queryKey: ['ws'] }),
    ])
}

/** Empty-state action: fills a brand-new database with clearly marked sample candidates. */
export function LoadSamplesButton() {
  const refresh = useRefreshAll()
  const [busy, setBusy] = useState(false)
  if (!dataApi.loadSampleData) return null
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const n = await dataApi.loadSampleData!()
            await refresh()
            if (n) toast.success(he.samples.loaded(n))
          } catch (e) {
            toast.error(he.common.unknownError, { description: errorMessage(e) })
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <FlaskConical />}
        {busy ? he.samples.loading : he.samples.load}
      </Button>
      <p className="max-w-xs text-center text-xs text-ink-muted">{he.samples.loadHint}</p>
    </div>
  )
}

/** Shown while sample candidates exist; removes all of them in one action. */
export function SampleDataBanner() {
  const { rows } = useCandidateIndex()
  const refresh = useRefreshAll()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const count = rows.filter((r) => r.is_sample).length
  if (!count || !dataApi.clearSampleData) return null
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-gold-300 bg-gold-100/50 px-4 py-2.5 text-sm text-gold-700">
      <FlaskConical className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{he.samples.banner(count)}</span>
      <Button
        size="sm"
        variant="ghost"
        className="text-danger hover:bg-danger-soft"
        disabled={busy}
        onClick={() => setConfirm(true)}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
        {he.samples.clear}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={he.samples.clearTitle}
        description={he.samples.clearText}
        confirmLabel={he.samples.clear}
        destructive
        onConfirm={async () => {
          setBusy(true)
          try {
            const n = await dataApi.clearSampleData!()
            await refresh()
            toast.success(he.samples.cleared(n))
          } catch (e) {
            toast.error(he.common.unknownError, { description: errorMessage(e) })
          } finally {
            setBusy(false)
          }
        }}
      />
    </div>
  )
}
