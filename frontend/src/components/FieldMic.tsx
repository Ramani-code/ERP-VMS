import { useEffect, useRef, useState } from 'react'
import { startDictation, type Dictation } from '../lib/dictation'
import type { VoiceLanguage } from '../lib/voice'

interface FieldMicProps {
  /** Shown to screen readers and in the tooltip, e.g. "Visitor name". */
  label: string
  lang: VoiceLanguage
  /** Receives what was said for this one field. The page checks it and fills the field. */
  onResult: (spoken: string) => void
}

/** Microphone button for a single field. Tap, say the value, and it fills that field. */
export default function FieldMic({ label, lang, onResult }: FieldMicProps) {
  const [active, setActive] = useState(false)
  const [live, setLive] = useState('')
  const [error, setError] = useState('')
  const sessionRef = useRef<Dictation | null>(null)
  const resultRef = useRef(onResult)
  resultRef.current = onResult

  useEffect(() => () => sessionRef.current?.abort(), [])

  const toggle = () => {
    if (active) {
      sessionRef.current?.stop()
      return
    }
    setError('')
    setLive('')
    setActive(true)
    let heard = ''
    sessionRef.current = startDictation({
      lang,
      continuous: false,
      onInterim: setLive,
      onFinal: (text) => {
        heard = `${heard} ${text}`.trim()
        setLive('')
        resultRef.current(heard)
      },
      onError: (message) => {
        setError(message)
        setActive(false)
      },
      onEnd: () => {
        sessionRef.current = null
        setActive(false)
        setLive('')
      }
    })
  }

  return (
    <div className="mic-field">
      <button
        type="button"
        className={`mic-btn mic-btn-sm ${active ? 'is-listening' : ''}`}
        onClick={toggle}
        aria-pressed={active}
        aria-label={active ? `Stop dictating ${label}` : `Dictate ${label}`}
        title={active ? 'Tap to stop' : `Tap and say the ${label.toLowerCase()}`}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <line x1="12" y1="18" x2="12" y2="21" />
        </svg>
        <span>{active ? 'Listening' : 'Speak'}</span>
      </button>
      {active && <span className="mic-live" role="status">{live || 'Say the value now…'}</span>}
      {error && <span className="mic-error" role="alert">{error}</span>}
    </div>
  )
}
