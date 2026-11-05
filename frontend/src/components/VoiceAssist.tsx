import { useState } from 'react'
import { Alert } from './Feedback'
import { MicIcon } from './icons'
import { useVoice } from '../lib/useVoice'
import { VOICE_LANGUAGES, type VoiceLang } from '../lib/voice'

const LANG_KEY = 'vms.voiceLang'

function savedLang(): VoiceLang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'en-IN' || v === 'hi-IN' || v === 'ta-IN') return v
  } catch { /* storage blocked: default to English */ }
  return 'en-IN'
}

interface Props {
  title: string
  example: string
  /** Parses the spoken or typed text into the form and returns the message to show. */
  onHeard: (text: string) => string
}

/**
 * Optional voice entry. Speak in English, Hindi or Tamil; the words appear in an editable box,
 * and "Fill fields" copies them into the form. Typing into the box works in every browser.
 */
export default function VoiceAssist({ title, example, onHeard }: Props) {
  const voice = useVoice()
  const [lang, setLangState] = useState<VoiceLang>(savedLang)
  const [note, setNote] = useState('')
  const [noteKind, setNoteKind] = useState<'success' | 'error'>('success')

  const setLang = (next: VoiceLang) => {
    if (voice.listening) voice.stop()
    setLangState(next)
    try { localStorage.setItem(LANG_KEY, next) } catch { /* storage blocked: the choice lasts this visit */ }
  }

  const toggle = () => {
    setNote('')
    if (voice.listening) voice.stop()
    else voice.start(lang)
  }

  const fill = () => {
    const text = voice.transcript.trim()
    if (!text) return
    const message = onHeard(text)
    setNoteKind(message.startsWith('Could not') || message.startsWith('Please') ? 'error' : 'success')
    setNote(message)
  }

  const clear = () => {
    voice.setTranscript('')
    setNote('')
  }

  return (
    <div className="voice-panel">
      <div className="voice-head">
        <div>
          <div className="voice-title"><MicIcon /> {title} <span className="badge badge-slate">Optional</span></div>
          <div className="person-sub">Speak the details, check the text, then press Fill fields. Review the form before you save.</div>
        </div>
        <select className="input voice-lang" aria-label="Voice language" value={lang}
          onChange={(e) => setLang(e.target.value as VoiceLang)}>
          {VOICE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </div>

      <div className="voice-row">
        <button type="button" className={`btn ${voice.listening ? 'btn-danger' : 'btn-primary'}`}
          onClick={toggle} disabled={!voice.supported && !voice.listening}>
          {voice.listening ? 'Stop listening' : 'Start speaking'}
        </button>
        {voice.listening && <span className="badge badge-green">● Listening</span>}
      </div>

      <label className="voice-field">
        <span className="eyebrow field-label">What was said</span>
        <textarea className="input voice-text" rows={2} readOnly={voice.listening}
          value={voice.transcript} onChange={(e) => voice.setTranscript(e.target.value)}
          placeholder={`Example: “${example}”`} aria-label="Spoken text" />
      </label>

      <div className="voice-row">
        <button type="button" className="btn btn-success" onClick={fill}
          disabled={voice.listening || !voice.transcript.trim()}>Fill fields</button>
        <button type="button" className="btn btn-secondary" onClick={clear}
          disabled={voice.listening || !voice.transcript && !note}>Clear</button>
      </div>

      {!voice.supported && <Alert kind="info">Voice input works in Google Chrome and Microsoft Edge. You can still type the details in the box and press Fill fields.</Alert>}
      {voice.error && <Alert>{voice.error}</Alert>}
      {note && <Alert kind={noteKind}>{note}</Alert>}
    </div>
  )
}
