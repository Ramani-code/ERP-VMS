import { useEffect, useRef, useState } from 'react'
import { startListening, voiceSupported, type VoiceLang } from '../lib/voice'
import { MicIcon } from './icons'

interface Props {
  lang: VoiceLang
  onText: (text: string) => void
  onMessage?: (message: string) => void
  label?: string
  compact?: boolean
  disabled?: boolean
}

/** Tap to speak. Press again to stop. The recognised text goes to onText. */
export default function VoiceButton({ lang, onText, onMessage, label = 'Speak', compact = false, disabled = false }: Props) {
  const [listening, setListening] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  const supported = voiceSupported()

  useEffect(() => () => { stopRef.current?.() }, [])

  const toggle = () => {
    if (listening) {
      stopRef.current?.()
      return
    }
    setListening(true)
    onMessage?.('Listening… speak now')
    stopRef.current = startListening(lang, {
      onInterim: (t) => onMessage?.(`Hearing: ${t}`),
      onFinal: (t) => { onMessage?.(`Heard: ${t}`); onText(t) },
      onError: (m) => onMessage?.(m),
      onEnd: () => { setListening(false); stopRef.current = null }
    })
  }

  return (
    <button
      type="button"
      className={`btn btn-voice ${compact ? 'btn-voice-compact' : ''} ${listening ? 'is-listening' : ''}`}
      onClick={toggle}
      disabled={disabled || !supported}
      aria-pressed={listening}
      aria-label={listening ? 'Stop listening' : label}
      title={supported ? (listening ? 'Stop listening' : label) : 'Voice entry needs Chrome, Edge or Android Chrome'}
    >
      <MicIcon />
      {!compact && <span>{listening ? 'Stop' : label}</span>}
    </button>
  )
}
