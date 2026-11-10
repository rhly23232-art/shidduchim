import { describe, expect, it } from 'vitest'
import { isSafeHref, isSafeImgSrc, sanitizeHtml } from '@/lib/sanitizeHtml'

describe('sanitizeHtml (Word preview)', () => {
  it('keeps plain document markup', () => {
    const html =
      '<h1>רזומה</h1><p>שם: <strong>יוסף</strong></p><ul><li>א</li></ul><table><tr><td colspan="2">x</td></tr></table>'
    expect(sanitizeHtml(html)).toBe(
      '<h1>רזומה</h1><p>שם: <strong>יוסף</strong></p><ul><li>א</li></ul><table><tbody><tr><td colspan="2">x</td></tr></tbody></table>',
    )
  })
  it('drops scripts, styles, iframes and their content', () => {
    const out = sanitizeHtml(
      '<p>a</p><script>alert(1)</script><style>p{}</style><iframe src="x"></iframe><svg><script>1</script></svg>',
    )
    expect(out).toBe('<p>a</p>')
  })
  it('removes event handlers and unknown attributes', () => {
    const out = sanitizeHtml(
      '<p onclick="x()" style="color:red" class="c" id="i">t</p><img src="data:image/png;base64,AAAA" onerror="x()">',
    )
    expect(out).toBe('<p>t</p><img src="data:image/png;base64,AAAA">')
  })
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'java&#9;script:alert(1)',
    ' \njavascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:x',
  ])('neutralizes dangerous link %j', (href) => {
    const out = sanitizeHtml(`<a href="${href}">קישור</a>`)
    expect(out).toBe('קישור')
  })
  it('keeps safe links and hardens them', () => {
    const out = sanitizeHtml('<a href="https://example.com">x</a>')
    expect(out).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">x</a>',
    )
  })
  it('allows only inline raster images', () => {
    expect(isSafeImgSrc('data:image/png;base64,AAA')).toBe(true)
    expect(isSafeImgSrc('data:image/svg+xml;base64,AAA')).toBe(false)
    expect(isSafeImgSrc('https://tracker.example/x.png')).toBe(false)
    expect(sanitizeHtml('<img src="https://tracker.example/x.png">')).toBe('')
  })
  it('url checks', () => {
    expect(isSafeHref('mailto:a@b.co')).toBe(true)
    expect(isSafeHref('#top')).toBe(true)
    expect(isSafeHref('file:///etc/passwd')).toBe(false)
  })
  it('unwraps unknown wrappers but keeps their cleaned text', () => {
    expect(sanitizeHtml('<section><div><p>a</p></div></section>')).toBe('<p>a</p>')
  })
})
