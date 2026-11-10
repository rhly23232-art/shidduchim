/**
 * Only same-app paths are accepted after sign-in ("/candidates?tab=male").
 * Rejects absolute URLs, protocol-relative "//host" and backslash tricks ("/\\host").
 */
export function safeRedirect(from: string | undefined): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return '/'
  for (const ch of from) if (ch.charCodeAt(0) < 0x20) return '/'
  return from
}
