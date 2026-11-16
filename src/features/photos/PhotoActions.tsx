import { Download, Eye, ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip } from '@/components/ui/tooltip'
import { PHOTO_ACCEPT } from '@/lib/files/image'
import { he } from '@/lib/strings.he'
import type { CandidateRow } from '@/lib/types'
import { cn, formatBytes, fullName } from '@/lib/utils'
import { usePhotoActions, usePhotoBusy, usePhotoUrl } from './photoActions'

const t = he.photo

/**
 * Candidate photo next to the resume. "Upload" opens the computer's file picker right away;
 * any image type is accepted and stored as a small JPEG.
 */
export function PhotoActions({
  candidate,
  variant,
}: {
  candidate: CandidateRow
  variant: 'compact' | 'full'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const actions = usePhotoActions()
  const isBusy = usePhotoBusy(candidate.id)
  const photo = candidate.photo ?? null
  const url = usePhotoUrl(photo)
  const name = fullName(candidate)
  const [viewing, setViewing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dropped, setDropped] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const pick = () => inputRef.current?.click()
  const send = (file: File | undefined) => {
    if (file) void actions.upload(candidate, file)
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={PHOTO_ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      data-photo-input={candidate.id}
      onChange={(e) => {
        send(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  const dialogs = (
    <>
      {photo && (
        <Dialog open={viewing} onOpenChange={setViewing}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t.of(name)}</DialogTitle>
            </DialogHeader>
            <DialogBody className="grid place-items-center">
              {url ? (
                <img
                  src={url}
                  alt={t.of(name)}
                  className="max-h-[70dvh] w-auto max-w-full rounded-md object-contain"
                />
              ) : (
                <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
              )}
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => void actions.download(photo)}>
                <Download />
                {t.download}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setViewing(false)
                  pick()
                }}
              >
                <RefreshCw />
                {t.replace}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {photo && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t.deleteTitle}
          description={t.deleteText}
          confirmLabel={he.common.delete}
          destructive
          onConfirm={() => void actions.remove(photo)}
        />
      )}
      <ConfirmDialog
        open={!!dropped}
        onOpenChange={(o) => !o && setDropped(null)}
        title={t.replaceTitle}
        description={dropped ? t.replaceText(dropped.name) : ''}
        confirmLabel={t.replaceConfirm}
        onConfirm={() => {
          send(dropped ?? undefined)
          setDropped(null)
        }}
      />
    </>
  )

  // ---------------------------- compact (table row / card / idea) ----------------------------
  if (variant === 'compact') {
    if (isBusy)
      return (
        <span className="grid size-8 place-items-center" role="status" aria-label={t.uploading}>
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
        </span>
      )
    if (!photo)
      return (
        <>
          {fileInput}
          <Tooltip content={t.upload}>
            <Button variant="ghost" size="sm" onClick={pick} aria-label={t.uploadFor(name)}>
              <ImagePlus />
              {t.uploadShort}
            </Button>
          </Tooltip>
          {dialogs}
        </>
      )
    return (
      <>
        {fileInput}
        <DropdownMenu dir="rtl">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t.actionsFor(name)}
              className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary transition-shadow duration-fast hover:ring-2 hover:ring-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {url ? (
                <img src={url} alt="" className="size-full object-cover" />
              ) : (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setViewing(true)}>
              <Eye />
              {t.view}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={pick}>
              <RefreshCw />
              {t.replace}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 />
              {t.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {dialogs}
      </>
    )
  }

  // ---------------------------- full (candidate card) ----------------------------
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (photo) setDropped(file)
    else send(file)
  }
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-input p-4 transition-colors duration-fast',
        dragOver && 'border-brand bg-accent',
      )}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {fileInput}
      {isBusy ? (
        <div className="flex items-center gap-3 py-2" role="status" aria-live="polite">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          <span className="text-body text-muted-foreground">{t.uploading}</span>
        </div>
      ) : photo ? (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setViewing(true)}
            aria-label={t.view}
            className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {url ? (
              <img src={url} alt={t.of(name)} className="size-full object-cover" />
            ) : (
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-medium text-foreground" dir="auto">
              {photo.file_name}
            </p>
            <p className="tabular text-caption text-muted-foreground">
              <span dir="ltr">{formatBytes(photo.size_bytes)}</span> ·{' '}
              {he.resume.uploadedAt(new Date(photo.uploaded_at).toLocaleDateString('he-IL'))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setViewing(true)}>
              <Eye />
              {t.view}
            </Button>
            <Button size="sm" variant="ghost" onClick={pick}>
              <RefreshCw />
              {t.replace}
            </Button>
            <Tooltip content={t.delete}>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                aria-label={t.delete}
              >
                <Trash2 />
              </Button>
            </Tooltip>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          aria-label={t.uploadFor(name)}
          className="flex w-full flex-col items-center gap-1 rounded-md py-3 text-center transition-colors duration-fast hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-body font-medium text-foreground">{t.dropHere}</span>
          <span className="text-caption text-muted-foreground">{t.accepted}</span>
        </button>
      )}
      {dialogs}
    </div>
  )
}
