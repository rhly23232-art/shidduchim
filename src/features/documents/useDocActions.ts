import { useMemo } from 'react'
import { toast } from 'sonner'
import type { EmailAttachment } from '@/features/resumes/ComposeEmailDialog'
import { sendViaServer } from '@/features/resumes/sendResumeEmail'
import { dataApi } from '@/lib/api'
import { DOCX_MIME } from '@/lib/files/docx'
import { blobToBase64, saveFile } from '@/lib/files/save'
import { he } from '@/lib/strings.he'
import { errorMessage } from '@/lib/utils'
import type { EmailFormValues } from '@/lib/validators'

/** Saves a generated Word file with a toast. */
export async function saveDocx(filename: string, blob: Blob) {
  try {
    if (await saveFile(filename, blob)) toast.success(he.exportCsv.done, { description: filename })
  } catch (e) {
    toast.error(he.exportCsv.failed, { description: errorMessage(e) })
  }
}

/** Email plumbing for a generated Word document (attachment + server route). */
export function useGeneratedAttachment(filename: string, build: () => Blob, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls rebuilds
  const blob = useMemo(build, deps)
  const attachment = useMemo<EmailAttachment>(
    () => ({
      name: filename,
      size: blob.size,
      load: async () => ({ blob, filename, mime: DOCX_MIME }),
      download: () => void saveDocx(filename, blob),
    }),
    [blob, filename],
  )
  const server = dataApi.supportsServerEmail
    ? async (v: EmailFormValues, idempotencyKey: string) =>
        sendViaServer({
          ...v,
          idempotencyKey,
          attachment: { filename, mime: DOCX_MIME, base64: await blobToBase64(blob) },
        })
    : undefined
  return { blob, attachment, server }
}
