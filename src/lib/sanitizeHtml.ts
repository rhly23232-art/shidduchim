/**
 * Allow-list HTML sanitizer for documents converted in the browser (mammoth → Word preview).
 * Resumes come from outside (families), so the output is treated as untrusted:
 * only plain document markup survives; every attribute except a few safe ones is dropped;
 * links must be http(s)/mailto/anchors and images must be inline raster data.
 */
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
  'colgroup',
  'col',
  'a',
  'img',
  'hr',
])
/** Elements whose whole content is dropped (not just the tag). */
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'template',
  'noscript',
  'svg',
  'math',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'frame',
  'frameset',
  'base',
])
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  ol: new Set(['start']),
}

// Browsers ignore ASCII whitespace/control chars inside URL schemes ("java\tscript:").
// eslint-disable-next-line no-control-regex -- control characters are exactly what must be removed
const normalizeUrl = (v: string) => v.replace(/[\x00-\x20\x7f-\x9f]/g, '').toLowerCase()

export function isSafeHref(v: string): boolean {
  const u = normalizeUrl(v)
  return (
    u.startsWith('#') || u.startsWith('http:') || u.startsWith('https:') || u.startsWith('mailto:')
  )
}
export function isSafeImgSrc(v: string): boolean {
  return /^data:image\/(png|jpe?g|gif|webp|bmp);base64,/.test(normalizeUrl(v))
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html')
  const root = doc.getElementById('__root')
  if (!root) return ''
  const walk = (parent: Element) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.COMMENT_NODE) {
        node.remove()
        continue
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue
      const el = node as Element
      const tag = el.tagName.toLowerCase()
      if (DROP_WITH_CONTENT.has(tag)) {
        el.remove()
        continue
      }
      walk(el)
      if (!ALLOWED_TAGS.has(tag)) {
        // unknown wrapper: keep its (already cleaned) children
        el.replaceWith(...Array.from(el.childNodes))
        continue
      }
      const allowed = ALLOWED_ATTRS[tag]
      for (const a of Array.from(el.attributes)) {
        const name = a.name.toLowerCase()
        const ok =
          !!allowed?.has(name) &&
          (name !== 'href' || isSafeHref(a.value)) &&
          (name !== 'src' || isSafeImgSrc(a.value))
        if (!ok) el.removeAttribute(a.name)
      }
      if (tag === 'a') {
        if (!el.getAttribute('href')) el.replaceWith(...Array.from(el.childNodes))
        else {
          el.setAttribute('target', '_blank')
          el.setAttribute('rel', 'noopener noreferrer nofollow')
        }
      }
      if (tag === 'img' && !el.getAttribute('src')) el.remove()
    }
  }
  walk(root)
  return root.innerHTML
}
