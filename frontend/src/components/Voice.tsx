import { useCallback, useEffect, useRef, useState } from 'react'
import { MicIcon } from './icons'
import {
  VOICE_LANGS, cancelSpeech, listen, normalize, speak, voiceSupported,
  type VoiceKind, type VoiceListener
} from '../lib/voice'

const LANG_KEY = 'vms.voiceLang'

/** <option> list for the voice-language dropdown. */
export const VOICE_LANG_OPTIONS = VOICE_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)

/** Remembers the spoken language (English / Tamil / Hindi) between visits. */
export function useVoiceLang() {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || 'en-IN' } catch { return 'en-IN' }
  })
  const setLang = (value: string) => {
    setLangState(value)
    try { localStorage.setItem(LANG_KEY, value) } catch { /* storage unavailable */ }
  }
  return [lang, setLang] as const
}

interface MicButtonProps {
  lang: string
  kind?: VoiceKind
  /** dropdown options, used when kind === 'choice' */
  options?: string[]
  /** shows a text button instead of the small round icon */
  label?: string
  disabled?: boolean
  onValue: (value: string) => void
  onError?: (message: string) => void
}

/** Microphone button: tap, speak, and the cleaned-up text is handed to onValue. */
export function MicButton({ lang, kind = 'text', options, label, disabled, onValue, onError }: MicButtonProps) {
  const [listening, setListening] = useState(false)
  const current = useRef<VoiceListener | null>(null)
  const latest = useRef({ onValue, onError })
  latest.current = { onValue, onError }

  useEffect(() => () => { current.current?.stop() }, [])

  if (!voiceSupported()) return null

  const toggle = async () => {
    if (listening) { current.current?.stop(); return }
    cancelSpeech()
    setListening(true)
    latest.current.onError?.('')
    const l = listen(lang)
    current.current = l
    try {
      const heard = await l.result
      const value = normalize(kind, heard, options)
      if (value) latest.current.onValue(value)
      else latest.current.onError?.(`Could not use “${heard}”. Please try again.`)
    } catch (e) {
      latest.current.onError?.(e instanceof Error ? e.message : 'Voice input failed')
    } finally {
      current.current = null
      setListening(false)
    }
  }

  const title = listening ? 'Listening… tap to stop' : 'Speak to fill this field'
  return (
    <button
      type="button"
      className={`mic-btn ${label ? 'mic-labeled' : ''} ${listening ? 'listening' : ''}`}
      onClick={() => void toggle()}
      disabled={disabled}
      title={title}
      aria-label={label ?? title}
      aria-pressed={listening}
    >
      <MicIcon />
      {label && <span>{listening ? 'Listening…' : label}</span>}
    </button>
  )
}

export interface VoiceStep {
  key: string
  prompt: string
  kind: VoiceKind
  options?: string[]
}

/**
 * "Fill the whole form by voice": asks for each field out loud, listens, fills it in and
 * moves to the next one. Say "skip" to leave a field empty or "stop" to finish.
 */
export function useGuidedVoice(lang: string, apply: (key: string, value: string) => void) {
  const [running, setRunning] = useState(false)
  const [active, setActive] = useState('')
  const [error, setError] = useState('')
  const stopped = useRef(false)
  const current = useRef<VoiceListener | null>(null)
  const applyRef = useRef(apply)
  applyRef.current = apply

  const stop = useCallback(() => {
    stopped.current = true
    current.current?.stop()
    cancelSpeech()
  }, [])

  useEffect(() => stop, [stop])

  const start = useCallback(async (steps: VoiceStep[]) => {
    stopped.current = false
    setRunning(true)
    setError('')
    try {
      for (const step of steps) {
        if (stopped.current) break
        setActive(step.key)
        let done = false
        for (let attempt = 0; attempt < 2 && !done && !stopped.current; attempt++) {
          await speak(attempt === 0 ? step.prompt : `Sorry, once more. ${step.prompt}`, lang)
          if (stopped.current) break
          const l = listen(lang)
          current.current = l
          try {
            const heard = await l.result
            const word = heard.trim().toLowerCase()
            if (['skip', 'next', 'pass'].includes(word)) {
              done = true
            } else if (['stop', 'cancel', 'finish', 'done'].includes(word)) {
              stopped.current = true
              done = true
            } else {
              const value = normalize(step.kind, heard, step.options)
              if (value) { applyRef.current(step.key, value); done = true; setError('') }
              else setError(`Could not use “${heard}”.`)
            }
          } catch (e) {
            if (stopped.current) break
            setError(e instanceof Error ? e.message : 'Voice input failed')
          } finally {
            current.current = null
          }
        }
      }
    } finally {
      cancelSpeech()
      setRunning(false)
      setActive('')
    }
  }, [lang])

  return { running, active, error, start, stop }
}

interface VoiceBarProps {
  lang: string
  onLang: (lang: string) => void
  running: boolean
  activeLabel?: string
  onStart: () => void
  onStop: () => void
  message?: string
}

/** Language picker + "fill by voice" button shown above a form. */
export function VoiceBar({ lang, onLang, running, activeLabel, onStart, onStop, message }: VoiceBarProps) {
  if (!voiceSupported()) {
    return (
      <div className="alert alert-info">
        Voice entry needs a browser with speech recognition (Google Chrome or Microsoft Edge) on https or localhost.
        You can still type every field.
      </div>
    )
  }
  return (
    <div className="voice-bar no-print">
      <div className="voice-bar-main">
        <span className="eyebrow">Voice entry</span>
        <select className="input voice-lang" value={lang} onChange={(e) => onLang(e.target.value)} disabled={running} aria-label="Voice language">
          {VOICE_LANG_OPTIONS}
        </select>
        {running ? (
          <button type="button" className="btn btn-danger btn-sm" onClick={onStop}>Stop voice entry</button>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onStart}>
            <MicIcon /> Fill form by voice
          </button>
        )}
      </div>
      <div className="voice-bar-hint">
        {running
          ? `Listening for: ${activeLabel || '…'} — say “skip” to leave it empty or “stop” to finish.`
          : 'Tap the mic inside any field to speak it, or let the form ask you each question.'}
        {message && <span className="voice-error"> {message}</span>}
      </div>
    </div>
  )
}
