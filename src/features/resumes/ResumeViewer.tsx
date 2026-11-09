import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip } from '@/components/ui/tooltip'
import { dataApi } from '@/lib/api'
import { he } from '@/lib/strings.he'
import { errorMessage, formatBytes } from '@/lib/utils'
import { useResumeActions } from './uploadResume'
import { closeResumeViewer, useResumeViewer } from './viewerStore'

type Loaded = { forId: string } & (
  | { kind: 'image'; url: string }
  | { kind: 'pdf'; doc: PdfDoc }
  | { kind: 'docx'; html: string }
)

interface PdfPage {
  getViewport(o: { scale: number }): { width: number; height: number }
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): {
    promise: Promise<void>
    cancel(): void
  }
}
interface PdfDoc {
  numPages: number
  getPage(n: number): Promise<PdfPage>
  destroy(): Promise<void>
}

async function loadPdf(blob: Blob): Promise<PdfDoc> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    isEvalSupported: false,
    // Draw glyph outlines directly — reliable for embedded Hebrew subset fonts.
    disableFontFace: true,
    useSystemFonts: false,
  })
  return (await task.promise) as unknown as PdfDoc
}

/** mammoth emits a small, safe tag set; strip anything active just in case. */
function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((n) => n.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value)))
        el.removeAttribute(a.name)
    }
  })
  return doc.body.firstElementChild?.innerHTML ?? ''
}

function PdfCanvas({ doc, page, scale }: { doc: PdfDoc; page: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    let task: { cancel(): void } | null = null
    // getPage throws synchronously once the document was destroyed — keep it inside the promise chain.
    void Promise.resolve()
      .then(() => doc.getPage(page))
      .then((p) => {
        if (cancelled || !ref.current) return
        const ratio = window.devicePixelRatio || 1
        const vp = p.getViewport({ scale: scale * ratio })
        const canvas = ref.current
        canvas.width = vp.width
        canvas.height = vp.height
        canvas.style.width = `${vp.width / ratio}px`
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const t = p.render({ canvasContext: ctx, viewport: vp })
        task = t
        t.promise.catch(() => undefined)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, page, scale])
  return <canvas ref={ref} className="mx-auto block max-w-full rounded-md bg-surface shadow-card" />
}

export function ResumeViewer() {
  const state = useResumeViewer()
  const { download } = useResumeActions()
  const [loadedState, setLoaded] = useState<Loaded | null>(null)
  // Only ever render content that belongs to the resume currently requested.
  const loaded = loadedState && state && loadedState.forId === state.resume.id ? loadedState : null
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1.25)

  useEffect(() => {
    if (!state) {
      setLoaded(null)
      return
    }
    const forId = state.resume.id
    let alive = true
    let cleanup: (() => void) | null = null
    setLoaded(null)
    setError(null)
    setPage(1)
    ;(async () => {
      try {
        const blob = await dataApi.getResumeBlob(state.resume)
        const mime = state.resume.mime_type
        if (mime.startsWith('image/')) {
          const url = URL.createObjectURL(blob)
          cleanup = () => URL.revokeObjectURL(url)
          if (alive) setLoaded({ forId, kind: 'image', url })
        } else if (mime === 'application/pdf') {
          const doc = await loadPdf(blob)
          cleanup = () => void doc.destroy()
          if (alive) setLoaded({ forId, kind: 'pdf', doc })
        } else {
          const mammoth = (await import('mammoth')).default
          const res = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() })
          if (alive) setLoaded({ forId, kind: 'docx', html: sanitize(res.value) })
        }
      } catch (e) {
        if (alive) setError(errorMessage(e))
      }
    })()
    return () => {
      alive = false
      cleanup?.()
    }
  }, [state])

  const pages = loaded?.kind === 'pdf' ? loaded.doc.numPages : 1

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && closeResumeViewer()}>
      <DialogContent className="h-[calc(100dvh-2rem)] max-w-4xl">
        <DialogHeader>
          <DialogTitle>{state ? he.viewer.title(state.title) : ''}</DialogTitle>
          <DialogDescription>
            {state && (
              <>
                <span dir="auto">{state.resume.file_name}</span> ·{' '}
                <span dir="ltr">{formatBytes(state.resume.size_bytes)}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="bg-cream-100/60">
          {error ? (
            <div role="alert" className="flex flex-col items-center gap-2 py-16 text-center">
              <AlertTriangle className="size-6 text-danger" aria-hidden />
              <p className="font-medium text-ink">{he.viewer.failed}</p>
              <p className="text-sm text-ink-muted">{error}</p>
            </div>
          ) : !loaded ? (
            <div className="flex flex-col items-center gap-2 py-24 text-ink-muted" role="status">
              <Loader2 className="size-6 animate-spin" aria-hidden />
              {he.viewer.loading}
            </div>
          ) : loaded.kind === 'image' ? (
            <img
              src={loaded.url}
              alt={state?.title ?? ''}
              className="mx-auto max-w-full rounded-md shadow-card"
              style={{ width: `${scale * 62}%` }}
            />
          ) : loaded.kind === 'pdf' ? (
            <div className="relative overflow-x-auto">
              <PdfCanvas doc={loaded.doc} page={page} scale={scale} />
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-3">
              <p className="rounded-lg bg-gold-100/60 px-3 py-2 text-xs text-gold-700">
                {he.viewer.docxNote}
              </p>
              <article
                dir="auto"
                className="rounded-md bg-surface p-8 text-[15px] leading-relaxed shadow-card [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_li]:ms-5 [&_li]:list-disc [&_p]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-line [&_td]:p-1.5"
                dangerouslySetInnerHTML={{ __html: loaded.html }}
              />
            </div>
          )}
        </DialogBody>
        <DialogFooter className="justify-between">
          <div className="flex items-center gap-1">
            <Tooltip content={he.viewer.zoomOut}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={he.viewer.zoomOut}
                onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
                disabled={!loaded || loaded.kind === 'docx'}
              >
                <ZoomOut />
              </Button>
            </Tooltip>
            <span className="tabular w-12 text-center text-xs text-ink-muted" dir="ltr">
              {Math.round(scale * 80)}%
            </span>
            <Tooltip content={he.viewer.zoomIn}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={he.viewer.zoomIn}
                onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))}
                disabled={!loaded || loaded.kind === 'docx'}
              >
                <ZoomIn />
              </Button>
            </Tooltip>
            {pages > 1 && (
              <div className="ms-3 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={he.viewer.prev}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronRight />
                </Button>
                <span className="tabular text-xs text-ink-muted">
                  {he.viewer.page(page, pages)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={he.viewer.next}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                >
                  <ChevronLeft />
                </Button>
              </div>
            )}
          </div>
          {state && (
            <Button variant="primary" onClick={() => void download(state.resume)}>
              <Download />
              {he.resume.download}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
