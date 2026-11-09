import {
  Download,
  Eye,
  FileText,
  FileUp,
  Image as ImageIcon,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Tooltip } from '@/components/ui/tooltip'
import { he } from '@/lib/strings.he'
import type { CandidateRow } from '@/lib/types'
import { cn, formatBytes, fullName } from '@/lib/utils'
import { RESUME_ACCEPT } from '@/lib/validators'
import { EmailDialog } from './EmailDialog'
import { checkResumeFile, isViewable, useResumeActions, useUploadProgress } from './uploadResume'

interface Props {
  candidate: CandidateRow
  variant: 'compact' | 'full'
}

interface PendingFile {
  file: File
  mime: string
}

export function ResumeActions({ candidate, variant }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const actions = useResumeActions()
  const pct = useUploadProgress(candidate.id)
  const [pending, setPending] = useState<PendingFile | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const resume = candidate.resume
  const name = fullName(candidate)
  const uploading = pct !== null

  const pick = () => inputRef.current?.click()

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const mime = await checkResumeFile(file)
    if (!mime) return
    if (resume) setPending({ file, mime })
    else void actions.upload(candidate, file, mime)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void handleFile(e.dataTransfer.files[0])
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={RESUME_ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        void handleFile(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  const dialogs = (
    <>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={he.resume.replaceTitle}
        description={
          pending && resume ? he.resume.replaceText(resume.file_name, pending.file.name) : ''
        }
        confirmLabel={he.resume.replaceConfirm}
        onConfirm={() => {
          if (pending) void actions.upload(candidate, pending.file, pending.mime)
          setPending(null)
        }}
      />
      {resume && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={he.resume.deleteTitle}
          description={he.resume.deleteText(resume.file_name)}
          confirmLabel={he.common.delete}
          destructive
          onConfirm={() => void actions.remove(resume)}
        />
      )}
      <EmailDialog open={emailOpen} onOpenChange={setEmailOpen} candidate={candidate} />
    </>
  )

  // ---------------------------- compact (table row / card) ----------------------------
  if (variant === 'compact') {
    if (uploading) {
      return (
        <div className="flex w-24 flex-col gap-1" role="status" aria-live="polite">
          <span className="tabular text-xs text-ink-muted">{he.resume.uploading(pct)}</span>
          <Progress value={pct} label={he.resume.progressLabel} />
        </div>
      )
    }
    if (!resume) {
      return (
        <>
          {fileInput}
          <Button
            variant="ghost"
            size="sm"
            onClick={pick}
            aria-label={`${he.resume.upload} — ${name}`}
          >
            <FileUp />
            {he.resume.uploadShort}
          </Button>
          {dialogs}
        </>
      )
    }
    return (
      <div className="flex items-center gap-0.5">
        {fileInput}
        <Tooltip content={`${he.resume.download} · ${resume.file_name}`}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void actions.download(resume)}
            aria-label={`${he.resume.download} — ${resume.file_name}`}
          >
            <Download />
          </Button>
        </Tooltip>
        <Tooltip content={he.resume.email}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEmailOpen(true)}
            aria-label={`${he.resume.email} — ${name}`}
          >
            <Mail />
          </Button>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={he.resume.actionsFor(name)}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {isViewable(resume.mime_type) && (
              <DropdownMenuItem onSelect={() => actions.view(resume, name)}>
                <Eye />
                {he.resume.view}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={pick}>
              <RefreshCw />
              {he.resume.replace}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 />
              {he.resume.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {dialogs}
      </div>
    )
  }

  // ---------------------------- full (detail modal) ----------------------------
  const FileIcon = resume?.mime_type.startsWith('image/') ? ImageIcon : FileText
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-line bg-cream-50/60 p-3 transition-colors duration-150',
        dragOver && 'border-gold-500 bg-gold-100/40',
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {fileInput}
      {uploading ? (
        <div className="flex flex-col gap-2 py-1" role="status" aria-live="polite">
          <span className="tabular text-sm text-ink-muted">{he.resume.uploading(pct)}</span>
          <Progress value={pct} label={he.resume.progressLabel} />
        </div>
      ) : resume ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-800">
              <FileIcon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink" dir="auto">
                {resume.file_name}
              </p>
              <p className="tabular text-xs text-ink-muted">
                <span dir="ltr">{formatBytes(resume.size_bytes)}</span> ·{' '}
                {he.resume.uploadedAt(new Date(resume.uploaded_at).toLocaleDateString('he-IL'))}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" onClick={() => void actions.download(resume)}>
              <Download />
              {he.resume.download}
            </Button>
            {isViewable(resume.mime_type) && (
              <Button size="sm" variant="ghost" onClick={() => actions.view(resume, name)}>
                <Eye />
                {he.resume.view}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={pick}>
              <RefreshCw />
              {he.resume.replace}
            </Button>
            <Tooltip content={he.resume.delete}>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-danger hover:bg-danger-soft"
                onClick={() => setConfirmDelete(true)}
                aria-label={he.resume.delete}
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
          className="flex w-full flex-col items-center gap-1 rounded-lg py-3 text-center transition-colors hover:bg-navy-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          <FileUp className="size-5 text-navy-700" aria-hidden />
          <span className="text-sm font-medium text-navy-900">{he.resume.dropHere}</span>
          <span className="text-xs text-ink-muted">{he.resume.accepted}</span>
        </button>
      )}
      {dialogs}
    </div>
  )
}

/** Email button for the modal footer (works with or without a resume). */
export function EmailResumeButton({ candidate }: { candidate: CandidateRow }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Mail />
        {he.resume.email}
      </Button>
      <EmailDialog open={open} onOpenChange={setOpen} candidate={candidate} />
    </>
  )
}

export function DownloadResumeButton({ candidate }: { candidate: CandidateRow }) {
  const { download } = useResumeActions()
  if (!candidate.resume) return null
  const resume = candidate.resume
  return (
    <Button variant="ghost" onClick={() => void download(resume)}>
      <Download />
      {he.resume.download}
    </Button>
  )
}
