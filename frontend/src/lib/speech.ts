/* Speech to text for the Visitor Registration and Vehicle Entry forms.
   It uses the browser's built-in recogniser (Chrome, Edge, Safari) and needs localhost or HTTPS. */

export type SpeechLang = 'en-IN' | 'ta-IN' | 'hi-IN'

export const SPEECH_LANGUAGES: { code: SpeechLang; label: string }[] = [
  { code: 'en-IN', label: 'English' },
  { code: 'ta-IN', label: 'Tamil · தமிழ்' },
  { code: 'hi-IN', label: 'Hindi · हिन्दी' }
]

interface ResultAlt { readonly transcript: string }
interface ResultItem extends ArrayLike<ResultAlt> { readonly isFinal: boolean }
interface RecognitionEvent { readonly resultIndex: number; readonly results: ArrayLike<ResultItem> }
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Null when speech to text can be used, otherwise the reason it cannot. */
export function speechUnavailable(): string | null {
  if (!ctor()) return 'Speech to text needs Chrome, Edge or Safari.'
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'The microphone only works on localhost or HTTPS. Open the app as http://localhost:5173.'
  }
  return null
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'The microphone is blocked. Click the lock icon in the address bar, allow the microphone and try again.',
  'service-not-allowed': 'The browser has blocked speech recognition for this site.',
  'audio-capture': 'No microphone was found on this device.',
  network: 'Speech recognition needs an internet connection.',
  'language-not-supported': 'This browser cannot listen in the chosen language. Pick another language.'
}

export interface Session {
  stop: () => void
  abort: () => void
}

export interface SpeechHandlers {
  lang: SpeechLang
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (message: string) => void
  onEnd: () => void
}

let current: Session | null = null

/** Starts listening. It keeps going through pauses until stop() is called. Only one session runs at a time. */
export function startSpeech(h: SpeechHandlers): Session | null {
  const Ctor = ctor()
  if (!Ctor) { h.onError('Speech to text needs Chrome, Edge or Safari.'); h.onEnd(); return null }
  current?.abort()

  const rec = new Ctor()
  rec.lang = h.lang
  rec.continuous = true
  rec.interimResults = true
  let wantStop = false
  let ended = false

  const finish = () => { if (!ended) { ended = true; if (current === session) current = null; h.onEnd() } }

  rec.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      const text = r[0]?.transcript ?? ''
      if (r.isFinal) h.onFinal(text.trim())
      else interim += text
    }
    h.onInterim(interim.trim())
  }
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return
    h.onError(ERRORS[e.error] ?? `Speech recognition stopped (${e.error}).`)
    wantStop = true
  }
  rec.onend = () => {
    h.onInterim('')
    // Browsers end a session after a long pause. Restart it until the user taps Stop.
    if (!wantStop && !ended) {
      try { rec.start(); return } catch { /* fall through and finish */ }
    }
    finish()
  }

  const session: Session = {
    stop: () => { wantStop = true; try { rec.stop() } catch { finish() } },
    abort: () => { wantStop = true; try { rec.abort() } catch { /* already stopped */ } finish() }
  }
  current = session
  try { rec.start() } catch { h.onError('Could not start the microphone. Try again.'); finish(); return null }
  return session
}

/* ---------------- turning what was said into field values ---------------- */

const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  'शून्य': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5', 'पाँच': '5', 'छह': '6', 'छः': '6', 'सात': '7', 'आठ': '8', 'नौ': '9',
  'பூஜ்யம்': '0', 'ஒன்று': '1', 'இரண்டு': '2', 'மூன்று': '3', 'நான்கு': '4', 'ஐந்து': '5', 'ஆறு': '6', 'ஏழு': '7', 'எட்டு': '8', 'ஒன்பது': '9'
}

/** Spoken digit words and Devanagari or Tamil numerals become 0-9. */
export function toAsciiDigits(text: string): string {
  const numerals = text
    .replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 0x0966))
    .replace(/[௦-௯]/g, (c) => String(c.charCodeAt(0) - 0x0be6))
  return numerals.split(/\s+/).map((w) => DIGIT_WORDS[w.toLowerCase()] ?? w).join(' ')
}

export function phoneFrom(text: string): string {
  const digits = toAsciiDigits(text).replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : digits
}

export function emailFrom(text: string): string {
  return text.toLowerCase()
    .replace(/\s+at the rate( of)?\s+|\s+at\s+/g, '@')
    .replace(/\s+dot\s+/g, '.')
    .replace(/\s+/g, '')
}

export function plateFrom(text: string): string {
  const raw = toAsciiDigits(text).toUpperCase().replace(/[^A-Z0-9]/g, '')
  const m = raw.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/)
  return m ? `${m[1]} ${m[2].padStart(2, '0')} ${m[3]} ${m[4]}` : raw
}

export function weightFrom(text: string): string {
  const m = toAsciiDigits(text).replace(/,/g, '').match(/\d+(\.\d+)?/)
  return m ? m[0] : ''
}

/** The option whose name matches what was said, or ''. Gate numbers match too ("gate two" finds "Gate 2"). */
export function optionFrom(text: string, options: string[]): string {
  const said = toAsciiDigits(text).toLowerCase().trim()
  if (!said) return ''
  const exact = options.find((o) => o.toLowerCase() === said)
  if (exact) return exact
  const partial = options.find((o) => said.includes(o.toLowerCase()) || o.toLowerCase().includes(said))
  if (partial) return partial
  const saidNum = said.match(/\d+/)?.[0]
  return (saidNum && options.find((o) => o.match(/\d+/)?.[0] === saidNum)) || ''
}

/**
 * Splits a sentence such as "name Ravi Kumar mobile 9845011223 purpose meeting" at the field names.
 * labels maps a field key to the words that introduce it (lower case, any language).
 */
export function splitByLabels(text: string, labels: Record<string, string[]>): Record<string, string> {
  const lookup = new Map<string, string>()
  Object.entries(labels).forEach(([key, words]) => words.forEach((w) => lookup.set(w.toLowerCase(), key)))
  const escaped = [...lookup.keys()].sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (escaped.length === 0) return {}
  const re = new RegExp(`(^|\\s)(${escaped.join('|')})(?=\\s|$|[:,.])`, 'giu')

  const hits: { key: string; start: number; end: number }[] = []
  for (const m of text.matchAll(re)) {
    const start = (m.index ?? 0) + m[1].length
    hits.push({ key: lookup.get(m[2].toLowerCase()) as string, start, end: start + m[2].length })
  }
  const out: Record<string, string> = {}
  hits.forEach((h, i) => {
    const value = text.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : text.length)
      .replace(/^[\s:,.\-]+|[\s:,.\-]+$/g, '')
    if (value) out[h.key] = value
  })
  return out
}
