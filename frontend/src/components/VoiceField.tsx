import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getSpeechRecognition, type SpeechRecognitionLike } from '../lib/voice'

const ERROR_TEXT: Record<string, string> = {
  'not-allowed': 'Microphone is blocked. Allow microphone access for this site and try again.',
  'service-not-allowed': 'Microphone is blocked. Allow microphone access for this site and try again.',
  'no-speech': 'No speech was heard. Tap the mic and speak.',
  'audio-capture': 'No microphone was found on this device.',
  network: 'Voice service could not be reached. It needs an internet connection.',
  'language-not-supported': 'This browser does not support English (India) voice entry.'
}

/**
 * Wraps a text input (or select) with a microphone button. Tap the mic, speak,
 * and the recognised words are passed to onTranscript, which fills the field.
 */
export default function VoiceField({ label, onTranscript, children }: {
  label: string
  onTranscript: (text: string) => void
  children: ReactNode
}) {
  const [listening, setListening] = useState(false)
  const [note, setNote] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const callbackRef = useRef(onTranscript)
  callbackRef.current = onTranscript
  const supported = getSpeechRecognition() !== null

  // Stop any open listening session when the form leaves the screen.
  useEffect(() => () => { recognitionRef.current?.abort() }, [])

  const toggle = () => {
    if (listening) { recognitionRef.current?.stop(); return }
    const Ctor = getSpeechRecognition()
    if (!Ctor) { setNote('Voice entry needs Chrome, Edge or Safari.'); return }

    const rec = new Ctor()
    rec.lang = 'en-IN'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0]?.transcript ?? '').join(' ').trim()
      if (text) {
        callbackRef.current(text)
        setNote(`Heard: "${text}"`)
      } else {
        setNote('Nothing was heard. Try again.')
      }
    }
    rec.onerror = (e) => setNote(ERROR_TEXT[e.error] ?? `Voice error: ${e.error}`)
    rec.onend = () => { setListening(false); recognitionRef.current = null }

    recognitionRef.current = rec
    setNote('')
    setListening(true)
    try {
      rec.start()
    } catch {
      recognitionRef.current = null
      setListening(false)
      setNote('Could not start the microphone. Try again.')
    }
  }

  return (
    <div className="voice-field-wrap">
      <div className="voice-field">
        {children}
        <button
          type="button"
          className={`mic-btn ${listening ? 'is-listening' : ''}`}
          onClick={toggle}
          disabled={!supported}
          aria-pressed={listening}
          aria-label={listening ? `Listening for ${label}. Click to stop.` : `Speak ${label}`}
          title={!supported ? 'Voice entry needs Chrome, Edge or Safari' : listening ? 'Listening… click to stop' : `Speak ${label}`}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <line x1="12" y1="18" x2="12" y2="21" />
          </svg>
        </button>
      </div>
      {listening && !note && <span className="voice-note" role="status">Listening… speak now.</span>}
      {note && <span className="voice-note" role="status">{note}</span>}
    </div>
  )
}
