// Every uploaded photo is stored as JPEG, so it displays on every device and
// exports cleanly to Google Photos (HEIC from iPhones is not readable by most
// browsers).
//  - JPEG: kept untouched (EXIF, incl. the date taken, is preserved).
//  - HEIC/HEIF: decoded natively where the browser can (Safari), otherwise
//    with heic2any, loaded on demand only when such a file is picked.
//  - Anything else (PNG, WebP…): re-encoded through a canvas.

const JPEG_QUALITY = 0.92
const MAX_PIXELS = 16_000_000 // iOS Safari refuses larger canvases (~16.7 MP)

export function isHeic(file) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

// Some systems (Windows) give HEIC files an empty MIME type.
export function isImage(file) {
  return file.type.startsWith('image/') || isHeic(file)
}

export async function toJpeg(file) {
  if (file.type === 'image/jpeg') return file
  if (isHeic(file)) {
    try { return await drawToJpeg(file) } catch { /* no native HEIC decoder */ }
    const { default: heic2any } = await import('heic2any')
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: JPEG_QUALITY })
    return Array.isArray(out) ? out[0] : out
  }
  return drawToJpeg(file)
}

async function drawToJpeg(file) {
  const bitmap = await createImageBitmap(file)
  try {
    const scale  = Math.min(1, Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)))
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff' // transparent PNG areas would otherwise turn black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', JPEG_QUALITY))
    if (!blob) throw new Error('JPEG encoding failed')
    return blob
  } finally {
    bitmap.close?.()
  }
}
