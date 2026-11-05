import { useEffect, useRef, useState } from 'react'
import { startDictation, voiceSupport, type Dictation } from '../lib/dictation'
import { parseSpokenFields, VOICE_LANGUAGES, type VoiceLanguage } from '../lib/voice'

/** One field the whole-form voice mode asks for, in order. */
export interface VoiceStep {
  key: string
  label: string
  hint?: string
}

export type Normalized = { value: string } | { error: string }

interface VoiceFillProps {
  /** Words that name each field, e.g. name: ['name', 'visitor name']. */
  labels: Record<string, string[]>
  steps: VoiceStep[]
  lang: VoiceLanguage
  onLangChange: (lang: VoiceLanguage) => void
  /** Checks a spoken answer for one field and returns the value to store, or what is wrong. */
  normalize: (key: string, spoken: string) => Normalized
  /** Receives the values that were recognised. The form applies them. */
  onFields: (patch: Record<string, string>) => void
}

/** The browser stops a listening session after a pause; restart it until the user taps stop. */
const MAX_RESTARTS = 40

/**
 * Whole-form voice entry. Each phrase is checked and applied as soon as it is final:
 *  - "name Ravi Kumar, mobile 9845011223" fills every field named;
 *  - a phrase with no field name answers the next unanswered field shown on screen.
 * The log shows what was heard and what it filled, so nothing happens silently.
 */
export default function VoiceFill(props: VoiceFillProps) {
  const { steps, lang, onLangChange } = props
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [problem, setProblem] = useState(() => voiceSupport() ?? '')

  const propsRef = useRef(props)
  propsRef.current = props
  const sessionRef = useRef<Dictation | null>(null)
  const wantRef = useRef(false)
  const restartsRef = useRef(0)
  const doneRef = useRef<Set<string>>(new Set())
  const langRef = useRef<VoiceLanguage>(lang)
  const launchRef = useRef<() => void>(() => undefined)

  /** Index of the first step not answered yet (steps.length when all are answered). */
  const nextIndex = () => {
    const i = propsRef.current.steps.findIndex((s) => !doneRef.current.has(s.key))
    return i === -1 ? propsRef.current.steps.length : i
  }
  const labelOf = (key: string) => propsRef.current.steps.find((s) => s.key === key)?.label ?? key

  const handlePhrase = (spoken: string, guided: boolean) => {
    const { labels: names, normalize, onFields } = propsRef.current
    const patch: Record<string, string> = {}
    const problems: string[] = []

    const found = parseSpokenFields(spoken, names)
    Object.entries(found).forEach(([key, raw]) => {
      const r = normalize(key, raw)
      if ('value' in r) patch[key] = r.value
      else problems.push(r.error)
    })

    if (guided && Object.keys(found).length === 0) {
      const idx = nextIndex()
      if (idx < propsRef.current.steps.length) {
        const key = propsRef.current.steps[idx].key
        const r = normalize(key, spoken)
        if ('value' in r) patch[key] = r.value
        else problems.push(r.error)
      }
    }

    const keys = Object.keys(patch)
    keys.forEach((k) => doneRef.current.add(k))
    if (keys.length) onFields(patch)
    setStepIndex(nextIndex())

    const filled = keys.length ? `filled ${keys.map(labelOf).join(', ')}` : 'not filled'
    const why = problems.length ? ` (${problems[0]})` : ''
    setLog((l) => [`“${spoken}” → ${filled}${why}`, ...l].slice(0, 8))
  }

  const launch = () => {
    sessionRef.current = startDictation({
      lang: langRef.current,
      continuous: true,
      onInterim: setInterim,
      onFinal: (text) => {
        restartsRef.current = 0
        setInterim('')
        setTranscript((t) => `${t} ${text}`.trim())
        handlePhrase(text, true)
      },
      onError: (message) => {
        wantRef.current = false
        setProblem(message)
      },
      onEnd: () => {
        sessionRef.current = null
        if (wantRef.current && restartsRef.current < MAX_RESTARTS) {
          restartsRef.current += 1
          launchRef.current()
          return
        }
        wantRef.current = false
        setRecording(false)
        setInterim('')
      }
    })
  }
  launchRef.current = launch

  useEffect(() => () => {
    wantRef.current = false
    sessionRef.current?.abort()
  }, [])

  const start = () => {
    const p = voiceSupport()
    if (p) { setProblem(p); return }
    setProblem('')
    setLog([])
    doneRef.current = new Set()
    restartsRef.current = 0
    langRef.current = lang
    wantRef.current = true
    setStepIndex(0)
    setRecording(true)
    launch()
  }

  const stop = () => {
    wantRef.current = false
    setRecording(false)
    sessionRef.current?.stop()
  }

  const skipStep = () => {
    const idx = nextIndex()
    if (idx >= steps.length) return
    doneRef.current.add(steps[idx].key)
    setStepIndex(nextIndex())
    setLog((l) => [`Skipped ${steps[idx].label}`, ...l].slice(0, 8))
  }

  const fillFromText = () => {
    const t = transcript.trim()
    if (!t) { setProblem('Nothing to fill yet. Speak, or type the details in the box first.'); return }
    handlePhrase(t, false)
  }

  const current = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))]
  const allAnswered = steps.length > 0 && stepIndex >= steps.length

  return (
    <div className="voice-panel">
      <div className="voice-controls">
        <button
          type="button"
          className={`mic-btn mic-btn-lg ${recording ? 'is-listening' : ''}`}
          onClick={() => (recording ? stop() : start())}
          aria-pressed={recording}
          aria-label={recording ? 'Stop voice entry' : 'Start voice entry'}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <line x1="12" y1="18" x2="12" y2="21" />
          </svg>
        </button>
        <select className="input voice-lang" value={lang} disabled={recording}
          onChange={(e) => onLangChange(e.target.value as VoiceLanguage)} aria-label="Voice language">
          {VOICE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gap: 8, minWidth: 0, flex: 1 }}>
        <div className="voice-prompt" role="status" aria-live="polite">
          {!recording && !allAnswered && <strong>Tap the microphone and speak the details. Each phrase fills the form as soon as it is recognised.</strong>}
          {recording && !allAnswered && current && (
            <>
              <strong>Listening. Next: say the {current.label.toLowerCase()}.</strong>
              {current.hint && <span className="voice-hint">{current.hint}</span>}
            </>
          )}
          {allAnswered && <strong>All fields are answered. Check them, then continue.</strong>}
          {steps.length > 0 && <span className="voice-progress">{Math.min(stepIndex + 1, steps.length)} of {steps.length} fields</span>}
        </div>

        {recording && !allAnswered && (
          <div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={skipStep}>Skip this field</button>
          </div>
        )}

        <textarea
          className="input voice-text"
          value={interim ? `${transcript} ${interim}`.trim() : transcript}
          readOnly={recording}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="What you say appears here. You can correct it, then press Fill from text."
          aria-label="Heard speech, which you can correct"
          rows={3}
        />
        <div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fillFromText} disabled={recording || !transcript.trim()}>
            Fill from text
          </button>
        </div>

        {log.length > 0 && (
          <ol className="voice-log" aria-label="What was heard">
            {log.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}
          </ol>
        )}
        {problem && <div className="voice-note" role="alert">{problem}</div>}
      </div>
    </div>
  )
}
