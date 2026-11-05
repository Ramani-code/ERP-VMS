import { getSpeechRecognition, type SpeechEventLike, type VoiceLanguage } from './voice'

export interface DictationOptions {
  lang: VoiceLanguage
  /** false: one phrase, then the browser stops on its own. true: keeps listening until stopped. */
  continuous: boolean
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (message: string) => void
  onEnd: () => void
}

export interface Dictation {
  stop: () => void
  abort: () => void
}

/** Why voice entry cannot run here, or null when it can. */
export function voiceSupport(): string | null {
  if (!window.isSecureContext) {
    return 'Voice entry works only on localhost or HTTPS. Open the app at http://localhost:5173 (not a LAN address).'
  }
  if (!getSpeechRecognition()) return 'Voice entry needs Chrome, Edge or Safari.'
  return null
}

/** A message a person can act on, or null for pauses that the browser handles itself. */
export function explainError(code: string): string | null {
  switch (code) {
    case 'no-speech':
    case 'aborted':
      return null
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Click the lock icon in the address bar, allow the microphone, and try again.'
    case 'audio-capture':
      return 'No microphone was found. Connect a microphone and try again.'
    case 'network':
      return 'Speech recognition could not reach its service. Check the internet connection and try again.'
    case 'language-not-supported':
      return 'The browser does not support the selected language. Choose English (India) and try again.'
    default:
      return `Voice input stopped (${code}). Tap the microphone to try again.`
  }
}

/** Starts one recognition session. Returns null (and reports through onError and onEnd) when it cannot start. */
export function startDictation(o: DictationOptions): Dictation | null {
  const problem = voiceSupport()
  const Ctor = getSpeechRecognition()
  if (problem || !Ctor) {
    o.onError(problem ?? 'Voice entry is not available in this browser.')
    o.onEnd()
    return null
  }
  const rec = new Ctor()
  rec.lang = o.lang
  rec.continuous = o.continuous
  rec.interimResults = true
  rec.maxAlternatives = 1

  rec.onresult = (e: SpeechEventLike) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i]
      const text = (result[0]?.transcript ?? '').trim()
      if (result.isFinal) {
        if (text) o.onFinal(text)
      } else {
        interim = `${interim} ${text}`
      }
    }
    o.onInterim(interim.trim())
  }
  rec.onerror = (e) => {
    const message = explainError(e.error)
    if (message) o.onError(message)
  }
  rec.onend = () => o.onEnd()

  try {
    rec.start()
  } catch {
    o.onError('Could not start the microphone. Try again.')
    o.onEnd()
    return null
  }
  return { stop: () => rec.stop(), abort: () => rec.abort() }
}
