import { useEffect, useRef, useState } from 'react'
import { toJpegDataUrl } from '../lib/photo'

/** Opens the device camera, captures a photo, and returns it as a JPEG data URL. Falls back to a file upload. */
export default function CameraCapture({ label, facing, value, onChange }: {
  label: string
  facing: 'user' | 'environment'
  value: string
  onChange: (dataUrl: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [live, setLive] = useState(false)
  const [error, setError] = useState('')

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLive(false)
  }

  // Attach the camera stream once the <video> element is on screen.
  useEffect(() => {
    if (live && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      void videoRef.current.play().catch(() => { /* autoplay blocked; the frame still shows on capture */ })
    }
  }, [live])

  // Release the camera when the form leaves the screen.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const open = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open the camera here. Choose a photo instead.')
      return
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false })
      setLive(true)
    } catch (e) {
      const blocked = e instanceof DOMException && e.name === 'NotAllowedError'
      setError(blocked ? 'Camera access was blocked. Allow the camera for this site.' : 'No camera was found. Choose a photo instead.')
      stop()
    }
  }

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    try {
      onChange(toJpegDataUrl(v, v.videoWidth, v.videoHeight))
      stop()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not capture the photo.')
    }
  }

  const fromFile = (file: File) => {
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        try { onChange(toJpegDataUrl(img, img.naturalWidth, img.naturalHeight)) }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not use that photo.') }
      }
      img.onerror = () => setError('That file is not a readable image.')
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="camera-box">
      <div className="eyebrow field-label">{label}</div>
      {value ? (
        <div className="camera-preview">
          <img src={value} alt={`${label} captured`} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange('')}>Retake</button>
        </div>
      ) : live ? (
        <>
          <video ref={videoRef} playsInline muted className="camera-video" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={capture}>Capture photo</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={stop}>Cancel</button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void open()}>Open camera</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>Upload photo</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture={facing} hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) fromFile(f); e.target.value = '' }} />
      {error && <div className="person-sub" style={{ color: 'var(--red)' }}>{error}</div>}
    </div>
  )
}
