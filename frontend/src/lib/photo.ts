const MAX_SIDE = 720

/** Draws a camera frame or image into a JPEG data URL, scaled so the longest side is at most 720px. */
export function toJpegDataUrl(source: CanvasImageSource, width: number, height: number): string {
  if (!width || !height) throw new Error('The photo is empty. Try again.')
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser could not prepare the photo.')
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8)
}
