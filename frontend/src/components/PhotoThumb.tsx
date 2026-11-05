import { useEffect, useState } from 'react'

/** Shows a stored photo, or the initials / a placeholder when there is no photo. */
export default function PhotoThumb({ src, fallback, size = 44, alt }: {
  src: string | null
  fallback: string
  size?: number
  alt: string
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])

  if (!src || failed) {
    return <div className="chip-avatar" role="img" aria-label={alt} style={{ width: size, height: size, flex: 'none' }}>{fallback}</div>
  }
  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)', flex: 'none', background: '#f1f5f9' }} />
  )
}
