import type { InputHTMLAttributes } from 'react'
import { useVoiceInput, type VoiceKind } from '../lib/voice'
import './voice.css'

type VoiceInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  /** Runs after a spoken value has been written into the field, e.g. to look up a pass straight away. */
  onFinal?: (value: string) => void
  /** Clean-up applied to speech for this field. */
  kind?: VoiceKind
  /** Used for the microphone button's accessible name, e.g. "Visitor name". */
  label: string
}

/**
 * A text input with a microphone button beside it. Typing still works everywhere.
 * Spans are used instead of divs so the component can sit inside a <label>.
 */
export default function VoiceInput({
  value, onChange, onFinal, kind = 'text', label, className = 'input', ...rest
}: VoiceInputProps) {
  const { supported, listening, interim, error, start, stop, clearError } = useVoiceInput((spoken) => {
    // Free text is appended to what is already there; names, numbers and codes are replaced.
    const next = kind === 'text' && value.trim() ? `${value.trim()} ${spoken}` : spoken
    onChange(next)
    onFinal?.(next)
  }, kind)

  return (
    <span className="voice-field">
      <span className="voice-row">
        <input
          {...rest}
          className={`${className} voice-input`}
          value={value}
          onChange={(e) => {
            clearError()
            onChange(e.target.value)
          }}
        />
        {supported && (
          <button
            type="button"
            className={`voice-btn${listening ? ' is-listening' : ''}`}
            onClick={listening ? stop : start}
            aria-pressed={listening}
            aria-label={listening ? `Stop voice entry for ${label}` : `Speak ${label}`}
            title={listening ? 'Stop listening' : 'Speak to fill this field'}
          >
            <MicIcon />
          </button>
        )}
      </span>
      {listening && (
        <span className="voice-status" role="status">
          Listening… {interim && <em>“{interim}”</em>}
        </span>
      )}
      {error && <span className="voice-error" role="alert">{error}</span>}
    </span>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8" />
    </svg>
  )
}
