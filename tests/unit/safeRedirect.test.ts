import { describe, expect, it } from 'vitest'
import { safeRedirect } from '@/lib/safeRedirect'

describe('safeRedirect', () => {
  it('keeps in-app paths with query', () => {
    expect(safeRedirect('/candidates?tab=male&c=1')).toBe('/candidates?tab=male&c=1')
    expect(safeRedirect('/')).toBe('/')
  })
  it('falls back to home for anything else', () => {
    for (const bad of [
      undefined,
      '',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '\\\\evil',
      'javascript:alert(1)',
      '/a\nb',
    ])
      expect(safeRedirect(bad)).toBe('/')
  })
})
