/**
 * Candidate photo: accepts any common image type and turns it into one small, clean JPEG.
 *  - JPG / PNG / WEBP / GIF / BMP / AVIF / ICO: decoded by the browser.
 *  - HEIC / HEIF (iPhone) and TIFF: decoded by a library that loads only when needed.
 * The result is at most 1600px on its long side, flattened on white, and carries no
 * metadata (EXIF location etc. is dropped by re-encoding). Orientation is applied.
 */

export type ImageKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp' | 'avif' | 'heic' | 'tiff' | 'ico'

export const PHOTO_MAX_INPUT = 40 * 1024 * 1024
export const PHOTO_MAX_SIDE = 1600
export const PHOTO_QUALITY = 0.86
/** File-picker filter: image/* plus the extensions some systems don't map to image/*. */
export const PHOTO_ACCEPT = 'image/*,.heic,.heif,.tif,.tiff,.avif,.bmp,.ico,.webp'

const ascii = (b: Uint8Array, from: number, len: number) =>
  String.fromCharCode(...b.subarray(from, from + len))

/** Recognizes the image format from the file's first bytes (not from its name). */
export function sniffImage(head: Uint8Array): ImageKind | null {
  const b = head
  const at = (...xs: number[]) => xs.every((x, i) => b[i] === x)
  if (at(0xff, 0xd8, 0xff)) return 'jpeg'
  if (at(0x89, 0x50, 0x4e, 0x47)) return 'png'
  if (ascii(b, 0, 4) === 'GIF8') return 'gif'
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp'
  if (ascii(b, 0, 2) === 'BM') return 'bmp'
  if (at(0x49, 0x49, 0x2a, 0x00) || at(0x4d, 0x4d, 0x00, 0x2a)) return 'tiff'
  if (at(0x00, 0x00, 0x01, 0x00)) return 'ico'
  if (ascii(b, 4, 4) === 'ftyp') {
    // ISO-BMFF: major brand + compatible brands
    const brands = ascii(b, 8, Math.min(b.length, 64) - 8)
    if (/avif|avis/.test(brands)) return 'avif'
    if (/heic|heix|hevc|hevx|heim|heis|mif1|msf1/.test(brands)) return 'heic'
  }
  return null
}

export class PhotoError extends Error {
  constructor(
    message: string,
    public code: 'not_image' | 'too_large' | 'decode',
  ) {
    super(message)
    this.name = 'PhotoError'
  }
}

export interface NormalizedPhoto {
  blob: Blob
  name: string
  width: number
  height: number
  kind: ImageKind
}

/** JPEG file name from the original name ("IMG_0042.HEIC" → "IMG_0042.jpg"). */
export function photoFileName(original: string): string {
  const stem = original.replace(/\.[^.]+$/, '').trim() || 'תמונה'
  return `${stem.slice(0, 120)}.jpg`
}

/** Target size: longest side ≤ max, never upscaled. */
export function fitWithin(w: number, h: number, max = PHOTO_MAX_SIDE) {
  const s = Math.min(1, max / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) }
}

async function decode(file: Blob, kind: ImageKind): Promise<ImageBitmap> {
  // The browser first (also covers HEIC/TIFF in Safari).
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    /* fall through to a library */
  }
  if (kind === 'heic') {
    const { default: heic2any } = await import('heic2any')
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 })
    return createImageBitmap(Array.isArray(out) ? out[0]! : out)
  }
  if (kind === 'tiff') {
    const mod = (await import('utif2')) as unknown as { default?: Utif } & Utif
    const UTIF: Utif = mod.default ?? mod
    const buf = await file.arrayBuffer()
    const ifds = UTIF.decode(buf)
    const page = ifds[0]
    if (!page) throw new Error('empty tiff')
    UTIF.decodeImage(buf, page)
    const rgba = UTIF.toRGBA8(page)
    const w = Number(page.width)
    const h = Number(page.height)
    return createImageBitmap(new ImageData(new Uint8ClampedArray(rgba), w, h))
  }
  throw new Error('undecodable')
}

interface Utif {
  decode(b: ArrayBuffer): { width?: number; height?: number }[]
  decodeImage(b: ArrayBuffer, ifd: object): void
  toRGBA8(ifd: object): Uint8Array
}

/** Any image file → JPEG ready to store. Throws PhotoError with a user-facing message. */
export async function normalizePhoto(
  file: File,
  messages: { notImage: string; tooLarge: string; decode: string },
): Promise<NormalizedPhoto> {
  if (file.size > PHOTO_MAX_INPUT) throw new PhotoError(messages.tooLarge, 'too_large')
  const kind = sniffImage(new Uint8Array(await file.slice(0, 64).arrayBuffer()))
  if (!kind) throw new PhotoError(messages.notImage, 'not_image')

  let bitmap: ImageBitmap
  try {
    bitmap = await decode(file, kind)
  } catch {
    throw new PhotoError(messages.decode, 'decode')
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoError(messages.decode, 'decode')
  ctx.fillStyle = '#ffffff' // transparent PNG/GIF/WEBP → white, not black
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/jpeg', PHOTO_QUALITY),
  )
  if (!blob) throw new PhotoError(messages.decode, 'decode')
  return { blob, name: photoFileName(file.name), width, height, kind }
}
