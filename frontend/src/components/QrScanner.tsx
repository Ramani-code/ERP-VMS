import { useEffect, useRef, useState } from 'react'
import { Alert } from './Feedback'

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike

const SCAN_INTERVAL_MS = 250

function cameraMessage(e: unknown): string {
  const name = (e as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was blocked. Allow the camera for this site, then open the scanner again.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found on this device. Use a USB scanner or type the pass number.'
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The camera is busy in another app. Close the other app and open the scanner again.'
  }
  return 'Could not start the camera. Use a USB scanner or type the pass number.'
}

/**
 * Live camera scanner using the browser's built-in QR detector (Chrome on Android and ChromeOS, and
 * recent desktop Chrome/Edge). Reports each pass code once, then stops the camera. Where the detector
 * is missing, the page explains it and the pass number can still be typed or scanned by a USB scanner.
 */
export default function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [error, setError] = useState('')
  const onScanRef = useRef(onScan)
  useEffect(() => { onScanRef.current = onScan }, [onScan])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
    if (!Detector) {
      setStatus('error')
      setError('This browser cannot read QR codes from the camera (Chrome on Android or ChromeOS can). Type the pass number or use a USB scanner.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError('The camera needs a secure (HTTPS) connection in this browser. Use a USB scanner or type the pass number.')
      return
    }

    let detector: BarcodeDetectorLike
    try {
      detector = new Detector({ formats: ['qr_code'] })
    } catch {
      setStatus('error')
      setError('QR scanning is not available in this browser. Type the pass number or use a USB scanner.')
      return
    }

    let stream: MediaStream | null = null
    let timer = 0
    let done = false
    let busy = false

    const stop = () => {
      done = true
      window.clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
      video.srcObject = null
    }

    const start = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        })
        if (done) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        video.srcObject = s
        await video.play()
        setStatus('scanning')
        timer = window.setInterval(async () => {
          if (done || busy || video.readyState < 2) return
          busy = true
          try {
            const codes = await detector.detect(video)
            const value = codes[0]?.rawValue?.trim()
            if (value && !done) {
              stop()
              onScanRef.current(value)
            }
          } catch {
            // a single unreadable frame is normal; keep scanning
          } finally {
            busy = false
          }
        }, SCAN_INTERVAL_MS)
      } catch (e) {
        if (!done) {
          done = true
          stream?.getTracks().forEach((t) => t.stop())
          setStatus('error')
          setError(cameraMessage(e))
        }
      }
    }

    void start()
    return stop
  }, [])

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner-video" playsInline muted autoPlay />
      {status === 'scanning' && <div className="scanner-frame" aria-hidden="true" />}
      {status === 'starting' && <div className="scanner-msg">Starting camera… allow access if the browser asks.</div>}
      {status === 'error' && <div className="scanner-msg"><Alert kind="info">{error}</Alert></div>}
    </div>
  )
}
