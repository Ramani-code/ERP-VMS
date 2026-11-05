import { useMemo } from 'react'
import { encodeQr, qrToSvgPath } from '../lib/qr'

/** Renders a real, scannable QR code (black on white) for the given text. */
export default function QrCode({ value, size = 120, label }: { value: string; size?: number; label?: string }) {
  const drawing = useMemo(() => {
    try {
      return { ...qrToSvgPath(encodeQr(value)), error: '' }
    } catch (e) {
      return { path: '', viewBox: 1, error: e instanceof Error ? e.message : 'Could not create the QR code' }
    }
  }, [value])

  if (drawing.error) {
    return <div className="qr-box qr-error" style={{ width: size, height: size }}>{drawing.error}</div>
  }
  return (
    <div className="qr-box" style={{ width: size, height: size }} role="img" aria-label={label ?? `QR code ${value}`}>
      <svg viewBox={`0 0 ${drawing.viewBox} ${drawing.viewBox}`} width="100%" height="100%" shapeRendering="crispEdges">
        <path d={drawing.path} fill="#000" />
      </svg>
    </div>
  )
}
