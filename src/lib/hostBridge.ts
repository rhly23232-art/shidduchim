/**
 * Optional bridge to the claude.ai viewer that may host this app (published Artifact).
 * Inside that frame, direct downloads, new tabs and mailto: links are blocked, so we use
 * the host's capabilities instead: `downloads` (save a file) and `mcp` (send through the
 * viewer's own Gmail connector). Outside the host every helper resolves to null and the
 * app uses its regular browser/server paths.
 */

interface HostDownloads {
  save(req: { filename: string; data: Blob | ArrayBuffer | string }): Promise<{ status: string }>
}
interface HostMcp {
  listTools(server?: string): Promise<{ fileArgs?: boolean }>
  callTool(server: string, tool: string, input?: unknown): Promise<{ payload?: unknown }>
}
interface HostClaude {
  use(name: string): Promise<unknown>
}

export interface HostError {
  code: string
  message?: string
}
export const hostErrorCode = (e: unknown): string | null =>
  typeof e === 'object' && e !== null && 'code' in e && typeof (e as HostError).code === 'string'
    ? (e as HostError).code
    : null

function hostClaude(): HostClaude | null {
  const c = (window as unknown as { claude?: HostClaude }).claude
  return c && typeof c.use === 'function' ? c : null
}

/** True when the page runs inside the claude.ai viewer frame. */
export const isHosted = (): boolean => hostClaude() !== null

const cache = new Map<string, Promise<unknown>>()
function capability<T>(name: string): Promise<T | null> {
  const c = hostClaude()
  if (!c) return Promise.resolve(null)
  if (!cache.has(name))
    cache.set(
      name,
      c.use(name).catch(() => null),
    )
  return cache.get(name)! as Promise<T | null>
}

export const hostDownloads = () => capability<HostDownloads>('downloads')
export const hostMcp = () => capability<HostMcp>('mcp')

export const GMAIL_SERVER = 'Gmail'
export const GMAIL_SEND_TOOL = 'send_message'

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk)
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(bin)
}

const INLINE_LIMIT = 700 * 1024 // base64 grows ×1.33; the call input is capped at 1 MiB

/** Sends through the viewer's Gmail connector. Rejects with a host error `{code}`. */
export async function sendViaGmail(input: {
  to: string
  subject: string
  body: string
  attachment?: { blob: Blob; filename: string; mime: string }
}): Promise<void> {
  const mcp = await hostMcp()
  if (!mcp) throw { code: 'unavailable' } satisfies HostError
  const attachments: unknown[] = []
  if (input.attachment) {
    const { blob, filename, mime } = input.attachment
    const listing = await mcp.listTools().catch(() => ({ fileArgs: false }))
    const ext = filename.split('.').pop()?.toLowerCase() || 'pdf'
    if (listing.fileArgs) {
      attachments.push({
        filename,
        mimeType: mime,
        content: { $file: { data: blob, name: `resume.${ext}`, type: mime } },
      })
    } else {
      if (blob.size > INLINE_LIMIT) throw { code: 'too_large' } satisfies HostError
      attachments.push({ filename, mimeType: mime, content: toBase64(await blob.arrayBuffer()) })
    }
  }
  await mcp.callTool(GMAIL_SERVER, GMAIL_SEND_TOOL, {
    to: [input.to.trim()],
    subject: input.subject,
    body: input.body,
    attachments,
  })
}

/** Offers a file through the host's save dialog. Returns false when the host can't. */
export async function saveViaHost(filename: string, data: Blob | string): Promise<boolean> {
  const dl = await hostDownloads()
  if (!dl) return false
  await dl.save({ filename, data })
  return true
}
