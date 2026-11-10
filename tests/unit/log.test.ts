import { describe, expect, it, vi } from 'vitest'
import { ConflictError } from '@/lib/api/errors'
import { JournalError } from '@/lib/api/journaled'
import { classify, log, logError, recentLog, redact } from '@/lib/log'

describe('redaction', () => {
  it('hides emails, tokens and phone numbers', () => {
    expect(redact('mail dana@example.co.il now')).toBe('mail [email] now')
    expect(redact('Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc-DEF_123')).toBe('Bearer [token]')
    expect(redact('key re_123456789012345678')).toBe('key [token]')
    expect(redact('call 050-1234567')).toBe('call [phone]')
  })
  it('drops secret-looking fields from context', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    log({
      level: 'error',
      event: 't',
      message: 'x',
      context: { password: 'p', token: 't', to: 'a@b.com' },
    })
    expect(recentLog().at(-1)!.context).toEqual({ to: '[email]' })
  })
})

describe('classify', () => {
  it.each([
    [new ConflictError(), 'user'],
    [new JournalError('x'), 'data'],
    [Object.assign(new Error('t'), { name: 'TimeoutError' }), 'recoverable'],
    [new TypeError('Failed to fetch'), 'recoverable'],
    [{ status: 503, message: 'down' }, 'provider'],
    [{ status: 429, message: 'slow down' }, 'user'],
    [new Error('JWT expired'), 'user'],
    [new Error('undefined is not a function'), 'system'],
  ])('%s → %s', (err, kind) => expect(classify(err)).toBe(kind))
})

describe('logError', () => {
  it('keeps a bounded, categorized buffer', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (let i = 0; i < 250; i++) logError('loop', new Error(`e${i}`))
    const all = recentLog()
    expect(all).toHaveLength(200)
    expect(all.at(-1)).toMatchObject({
      level: 'error',
      kind: 'system',
      event: 'loop',
      message: 'Error: e249',
    })
  })
})
