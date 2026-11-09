import { hostErrorCode, isHosted, saveViaHost } from '@/lib/hostBridge'

/**
 * Saves a generated file. Inside the claude.ai viewer direct downloads are blocked, so the
 * viewer's save dialog is used. Returns false when the user declined the save dialog.
 */
export async function saveFile(filename: string, blob: Blob): Promise<boolean> {
  try {
    if (isHosted() && (await saveViaHost(filename, blob))) return true
  } catch (e) {
    if (hostErrorCode(e) === 'declined') return false
    throw e
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}

/** yyyy-mm-dd of today (local time) — for file names. */
export const todayStamp = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Base64 of a blob (for JSON payloads). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/** Plain mailto: link (cannot carry attachments). */
export const mailtoUrl = (to: string, subject: string, body: string) =>
  `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
