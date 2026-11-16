import { describe, expect, it } from 'vitest'
import { fitWithin, photoFileName, sniffImage } from '@/lib/files/image'

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(
    xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])),
  )
const ftyp = (brand: string, compat = '') => bytes(0, 0, 0, 0x18, 'ftyp', brand, 0, 0, 0, 0, compat)

describe('sniffImage', () => {
  it('recognizes formats by content, not name', () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg')
    expect(sniffImage(bytes(0x89, 'PNG', 0x0d, 0x0a))).toBe('png')
    expect(sniffImage(bytes('GIF89a'))).toBe('gif')
    expect(sniffImage(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe('webp')
    expect(sniffImage(bytes('BM', 0, 0))).toBe('bmp')
    expect(sniffImage(bytes('II', 0x2a, 0))).toBe('tiff')
    expect(sniffImage(bytes('MM', 0, 0x2a))).toBe('tiff')
    expect(sniffImage(bytes(0, 0, 1, 0))).toBe('ico')
    expect(sniffImage(ftyp('heic', 'mif1heic'))).toBe('heic')
    expect(sniffImage(ftyp('mif1', 'heic'))).toBe('heic')
    expect(sniffImage(ftyp('avif', 'mif1avif'))).toBe('avif')
  })
  it('rejects non-images', () => {
    expect(sniffImage(bytes('%PDF-1.4'))).toBeNull()
    expect(sniffImage(bytes('PK', 3, 4))).toBeNull()
    expect(sniffImage(bytes('<svg'))).toBeNull()
    expect(sniffImage(ftyp('isom', 'mp41'))).toBeNull() // video
  })
})

describe('photo sizing and naming', () => {
  it('fits the long side to 1600 without upscaling', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(1000, 3000)).toEqual({ width: 533, height: 1600 })
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
  it('always names the result .jpg', () => {
    expect(photoFileName('IMG_0042.HEIC')).toBe('IMG_0042.jpg')
    expect(photoFileName('תמונה של משה.png')).toBe('תמונה של משה.jpg')
    expect(photoFileName('.tiff')).toBe('תמונה.jpg')
  })
})
