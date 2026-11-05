import { useEffect, useRef, useState } from 'react'
import { SPEECH_LANGUAGES, speechUnavailable, splitByLabels, startSpeech, type Session, type SpeechLang } from '../lib/speech'

interface Props {
  /** Words that introduce each field, per field key. */
  labels: Record<string, string[]>
  /** Turns what was said for one field into the value to store. Return '' to skip the field. */
  normalize: (key: string, spoken: string) => string
  /** Receives the fields that were recognised. */
  onFields: (patch: Record<string, string>) => void
  /** Field names shown in the "Filled" note, per field key. */
  names: Record<string, string>
  /** A short example shown under the microphone. */
  example: string
  /** Changing this value (for example after the form is cleared) empties the transcript. */
  resetKey?: number
}

const MIC_PATH = 'M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v3'

/** One microphone for a whole form: say the field names and values, and the form fills as you speak. */
export default function SpeechToText({ labels, normalize, onFields, names, example, resetKey }: Props) {
  const [lang, setLang] = useState<SpeechLang>('en-IN')
  const [listening, setListening] = useState(false)
  const [text, setText] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const [filled, setFilled] = useState<string[]>([])
  const session = useRef<Session | null>(null)
  const transcript = useRef('')
  const applied = useRef<Record<string, string>>({})
  const latest = useRef({ labels, normalize, onFields })
  latest.current = { labels, normalize, onFields }
  const unavailable = speechUnavailable()

  useEffect(() => () => session.current?.abort(), [])

  const clear = () => {
    transcript.current = ''
    applied.current = {}
    setText(''); setInterim(''); setFilled([]); setError('')
  }

  useEffect(() => {
    if (resetKey !== undefined) clear()
  }, [resetKey])

  /** Reads the whole transcript again and fills only the fields whose spoken value changed. */
  const fill = () => {
    const { labels: l, normalize: n, onFields: apply } = latest.current
    const spoken = splitByLabels(transcript.current, l)
    const patch: Record<string, string> = {}
    for (const [key, raw] of Object.entries(spoken)) {
      if (applied.current[key] === raw) continue
      applied.current[key] = raw
      const value = n(key, raw)
      if (value) patch[key] = value
    }
    const keys = Object.keys(patch)
    if (keys.length > 0) {
      apply(patch)
      setFilled((f) => [...new Set([...f, ...keys])])
    }
  }

  const toggle = () => {
    if (listening) { session.current?.stop(); return }
    setError('')
    setListening(true)
    session.current = startSpeech({
      lang,
      onInterim: setInterim,
      onFinal: (t) => {
        if (!t) return
        transcript.current = `${transcript.current} ${t}`.trim()
        setText(transcript.current)
        fill()
      },
      onError: setError,
      onEnd: () => { setListening(false); setInterim('') }
    })
  }

  return (
    <div className="speech-panel">
      <div className="speech-head">
        <span className="speech-title">Speech to text</span>
        <div className="speech-controls">
          <select className="input speech-lang" value={lang} disabled={listening} aria-label="Speech language"
            onChange={(e) => setLang(e.target.value as SpeechLang)}>
            {SPEECH_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button type="button" className={`btn btn-secondary ${listening ? 'mic-listening' : ''}`}
            disabled={!!unavailable} onClick={toggle} aria-pressed={listening}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 6, verticalAlign: '-3px' }}>
              <path d={MIC_PATH} />
            </svg>
            {listening ? 'Stop' : 'Start speaking'}
          </button>
          {text && !listening && <button type="button" className="btn btn-secondary" onClick={clear}>Clear text</button>}
        </div>
      </div>
      <div className="speech-box" aria-live="polite">
        {text || interim ? <>{text} <span className="interim">{interim}</span></> :
          <span className="speech-hint">{listening ? 'Listening… start speaking.' : 'What you say appears here.'}</span>}
      </div>
      <div className="speech-hint">Say a field name, then its value. Example: {example}</div>
      {filled.length > 0 && <div className="speech-filled" role="status">Filled: {filled.map((k) => names[k] ?? k).join(', ')}. Check the fields, and correct any by typing.</div>}
      {(unavailable || error) && <div className="alert alert-error" role="alert">{unavailable || error}</div>}
    </div>
  )
}
