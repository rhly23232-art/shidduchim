/**
 * Minimal ZIP reader for Office files and our backups. Uses the browser's DecompressionStream
 * ('deflate-raw') — no dependency. Supports STORE and DEFLATE entries.
 */
export type ZipFiles = Map<string, () => Promise<Uint8Array>>

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function unzip(input: Blob | ArrayBuffer): Promise<ZipFiles> {
  const buf = new Uint8Array(input instanceof Blob ? await input.arrayBuffer() : input)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  // End of central directory: last 22..65557 bytes
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip file')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const dec = new TextDecoder()
  const files: ZipFiles = new Map()
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('corrupt zip')
    const method = view.getUint16(p + 10, true)
    const compSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOff = view.getUint32(p + 42, true)
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    if (name.endsWith('/')) continue
    files.set(name, async () => {
      const lNameLen = view.getUint16(localOff + 26, true)
      const lExtraLen = view.getUint16(localOff + 28, true)
      const start = localOff + 30 + lNameLen + lExtraLen
      const raw = buf.subarray(start, start + compSize)
      if (method === 0) return raw
      if (method === 8) return inflateRaw(raw)
      throw new Error('unsupported zip compression')
    })
  }
  return files
}

export async function readText(files: ZipFiles, name: string): Promise<string | null> {
  const get = files.get(name)
  return get ? new TextDecoder().decode(await get()) : null
}
