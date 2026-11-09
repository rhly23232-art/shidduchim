import { FlaskConical, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useCandidateIndex, useRefreshAll } from '@/hooks/useWorkspace'
import { dataApi } from '@/lib/api'
import { he } from '@/lib/strings.he'
import { errorMessage } from '@/lib/utils'

/** Empty-state action: fills a brand-new database with clearly marked sample candidates. */
export function LoadSamplesButton() {
  const refresh = useRefreshAll()
  const [busy, setBusy] = useState(false)
  if (!dataApi.loadSampleData) return null
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        loading={busy}
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
        {!busy && <FlaskConical />}
        {busy ? he.samples.loading : he.samples.load}
      </Button>
      <p className="max-w-xs text-center text-caption text-muted-foreground">
        {he.samples.loadHint}
      </p>
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
    <Alert
      tone="info"
      className="mb-4"
      icon={<FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />}
      action={
        <Button size="sm" variant="outline" loading={busy} onClick={() => setConfirm(true)}>
          {!busy && <Trash2 />}
          {he.samples.clear}
        </Button>
      }
    >
      {he.samples.banner(count)}
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
    </Alert>
  )
}
