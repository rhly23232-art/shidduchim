/**
 * The Gmail route (inside claude.ai) with a fake host: what reaches Gmail's send_message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { server: string; tool: string; input: { attachments: unknown[]; to: string[] } }

async function setup(opts: { fileArgs: boolean }) {
  vi.resetModules()
  const calls: Call[] = []
  const mcp = {
    listTools: async () => ({ fileArgs: opts.fileArgs }),
    callTool: async (server: string, tool: string, input: Call['input']) => {
      calls.push({ server, tool, input })
      return {}
    },
  }
  ;(window as unknown as { claude: unknown }).claude = {
    use: async (name: string) => (name === 'mcp' ? mcp : null),
  }
  const { sendViaGmail } = await import('@/lib/hostBridge')
  return { calls, sendViaGmail }
}

const file = (name: string, size: number, mime: string) => ({
  blob: new Blob([new Uint8Array(size)], { type: mime }),
  filename: name,
  mime,
})

describe('sendViaGmail with several attachments', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => delete (window as unknown as { claude?: unknown }).claude)

  it('sends the resume and the photo in one message', async () => {
    const { calls, sendViaGmail } = await setup({ fileArgs: false })
    await sendViaGmail({
      to: ' family@example.com ',
      subject: 's',
      body: 'b',
      attachments: [
        file('רזומה.pdf', 40_000, 'application/pdf'),
        file('תמונה.jpg', 120_000, 'image/jpeg'),
      ],
    })
    expect(calls).toHaveLength(1)
    const { input } = calls[0]!
    expect(input.to).toEqual(['family@example.com'])
    const atts = input.attachments as { filename: string; mimeType: string; content: string }[]
    expect(atts.map((a) => [a.filename, a.mimeType])).toEqual([
      ['רזומה.pdf', 'application/pdf'],
      ['תמונה.jpg', 'image/jpeg'],
    ])
    expect(atts.every((a) => typeof a.content === 'string' && a.content.length > 0)).toBe(true)
  })

  it('puts files beyond the inline budget on the file route', async () => {
    const { calls, sendViaGmail } = await setup({ fileArgs: true })
    await sendViaGmail({
      to: 'a@b.co',
      subject: 's',
      body: 'b',
      attachments: [
        file('big.pdf', 650_000, 'application/pdf'),
        file('photo.jpg', 200_000, 'image/jpeg'),
      ],
    })
    const atts = calls[0]!.input.attachments as { filename: string; content: unknown }[]
    expect(typeof atts[0]!.content).toBe('string') // fits inline
    expect(atts[1]!.content).toMatchObject({ $file: { type: 'image/jpeg' } }) // budget used up
  })

  it('refuses (does not drop the photo) when the files cannot fit and there is no file route', async () => {
    const { calls, sendViaGmail } = await setup({ fileArgs: false })
    await expect(
      sendViaGmail({
        to: 'a@b.co',
        subject: 's',
        body: 'b',
        attachments: [
          file('big.pdf', 650_000, 'application/pdf'),
          file('p.jpg', 200_000, 'image/jpeg'),
        ],
      }),
    ).rejects.toMatchObject({ code: 'too_large' })
    expect(calls).toHaveLength(0)
  })

  it('sends without attachments when none are included', async () => {
    const { calls, sendViaGmail } = await setup({ fileArgs: false })
    await sendViaGmail({ to: 'a@b.co', subject: 's', body: 'b', attachments: [] })
    expect(calls[0]!.input.attachments).toEqual([])
  })
})
