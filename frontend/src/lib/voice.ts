/* Voice entry uses the browser's built-in speech recognition (Chrome, Edge, Safari).
   Typings are declared here because not every TypeScript DOM library includes them. */

export interface SpeechResultLike { readonly transcript: string }
export interface SpeechResultListLike extends ArrayLike<SpeechResultLike> { readonly isFinal: boolean }
export interface SpeechEventLike {
  readonly resultIndex: number
  readonly results: ArrayLike<SpeechResultListLike>
}
export interface SpeechErrorLike { readonly error: string }

export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: SpeechEventLike) => void) | null
  onerror: ((e: SpeechErrorLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

/** The browser's speech recogniser, or null when voice entry is not supported. */
export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const ERROR_TEXT: Record<string, string> = {
  'not-allowed': 'Microphone is blocked. Allow microphone access for this site (lock icon in the address bar) and try again.',
  'service-not-allowed': 'Speech recognition is blocked by the browser for this site.',
  'audio-capture': 'No microphone was found on this device.',
  network: 'Voice service could not be reached. It needs an internet connection.',
  'language-not-supported': 'This browser cannot listen in the selected language. Choose another language.'
}

export type VoiceLanguage = 'en-IN' | 'ta-IN' | 'hi-IN'

export const VOICE_LANGUAGES: { code: VoiceLanguage; label: string }[] = [
  { code: 'en-IN', label: 'English' },
  { code: 'ta-IN', label: 'Tamil · தமிழ்' },
  { code: 'hi-IN', label: 'Hindi · हिन्दी' }
]

/** Words that introduce each field, in English, Tamil and Hindi. Lower case only. */
export const VISITOR_LABELS: Record<string, string[]> = {
  name: ['visitor name', 'name', 'பெயர்', 'नाम'],
  mobile: ['mobile number', 'mobile no', 'mobile', 'phone number', 'phone', 'contact number', 'contact', 'மொபைல்', 'தொலைபேசி', 'मोबाइल', 'फोन'],
  email: ['email id', 'email', 'mail', 'மின்னஞ்சல்', 'ईमेल'],
  company: ['company name', 'company', 'firm', 'நிறுவனம்', 'कंपनी'],
  purpose: ['purpose of visit', 'purpose', 'reason', 'நோக்கம்', 'उद्देश्य'],
  host: ['host name', 'host', 'to meet', 'ஹோஸ்ட்', 'சந்திக்க', 'होस्ट', 'मिलना'],
  department: ['department', 'dept', 'துறை', 'विभाग'],
  gate: ['entry gate', 'gate', 'கேட்', 'गेट']
}

export const VEHICLE_LABELS: Record<string, string[]> = {
  vehicleNumber: ['vehicle number', 'vehicle no', 'number plate', 'vehicle', 'வாகன எண்', 'வாகனம்', 'वाहन नंबर', 'वाहन'],
  driverName: ['driver name', 'driver', 'ஓட்டுநர்', 'ड्राइवर'],
  vendor: ['vendor name', 'vendor', 'supplier', 'விற்பனையாளர்', 'विक्रेता'],
  material: ['material', 'goods', 'பொருள்', 'सामान'],
  purpose: ['purpose', 'reason', 'நோக்கம்', 'उद्देश्य'],
  loadWeight: ['load weight', 'weight', 'load', 'எடை', 'वजन'],
  gate: ['entry gate', 'gate', 'கேட்', 'गेट']
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Splits a spoken sentence into field values, e.g.
 * "name Ravi Kumar mobile 9876543210 host Arun purpose meeting"
 * becomes { name: 'Ravi Kumar', mobile: '9876543210', host: 'Arun', purpose: 'meeting' }.
 * Labels are matched case-insensitively; the value keeps the speaker's spelling.
 */
export function parseSpokenFields(text: string, labels: Record<string, string[]>): Record<string, string> {
  const pairs: { label: string; key: string }[] = []
  Object.entries(labels).forEach(([key, words]) => words.forEach((label) => pairs.push({ label: label.toLowerCase(), key })))
  pairs.sort((a, b) => b.label.length - a.label.length)

  const pattern = new RegExp(
    `(^|[\\s,.;])(${pairs.map((p) => escapeRegex(p.label)).join('|')})(?=$|[\\s,.;:])`,
    'gi'
  )
  const hits: { key: string; start: number; end: number }[] = []
  for (const m of text.matchAll(pattern)) {
    const pair = pairs.find((p) => p.label === m[2].toLowerCase())
    if (!pair) continue
    const start = (m.index ?? 0) + m[1].length
    hits.push({ key: pair.key, start, end: start + m[2].length })
  }

  const result: Record<string, string> = {}
  hits.forEach((hit, i) => {
    if (result[hit.key] !== undefined) return
    const stop = i + 1 < hits.length ? hits[i + 1].start : text.length
    const value = text.slice(hit.end, stop)
      .replace(/^[\s:–-]+/, '')
      .replace(/[\s,.;]+$/, '')
      .replace(/^(is|as|the)\s+/i, '')
      .trim()
    if (value) result[hit.key] = value
  })
  return result
}

/** Spoken digit words, so "nine eight four" becomes "984". */
const DIGIT_WORDS = new Map<string, string>([
  ['zero', '0'], ['oh', '0'], ['o', '0'], ['one', '1'], ['two', '2'], ['three', '3'], ['four', '4'],
  ['five', '5'], ['six', '6'], ['seven', '7'], ['eight', '8'], ['nine', '9']
])

/** Spoken digits ("nine eight four five…") or numerals become a plain number string. */
export const spokenDigits = (text: string) =>
  text.toLowerCase().split(/[\s,.-]+/).map((w) => DIGIT_WORDS.get(w) ?? w).join('').replace(/[^\d+]/g, '')

/**
 * Finds a 10-digit mobile number anywhere in the sentence, whether it was spoken as
 * digit words or typed as numerals. Used when the speaker did not say "mobile".
 */
export function findPhone(text: string): string | undefined {
  let best = ''
  let run = ''
  for (const raw of text.toLowerCase().split(/[\s,.-]+/)) {
    const digit = DIGIT_WORDS.get(raw) ?? (/^\d+$/.test(raw) ? raw : undefined)
    if (digit === undefined) {
      if (run.length > best.length) best = run
      run = ''
    } else {
      run += digit
    }
  }
  if (run.length > best.length) best = run
  if (best.length > 10 && best.startsWith('91')) best = best.slice(2)
  return best.length === 10 ? best : undefined
}

/** "ravi at gmail dot com" becomes "ravi@gmail.com". */
export const spokenEmail = (text: string) =>
  text.toLowerCase().replace(/\s+at\s+/g, '@').replace(/\s+dot\s+/g, '.').replace(/\s+/g, '')

/** Finds the list entry (for example a department) that matches what was said. */
export function matchOption(spoken: string, options: string[]): string | undefined {
  const s = spoken.trim().toLowerCase()
  if (!s) return undefined
  return options.find((o) => o.toLowerCase() === s)
    ?? options.find((o) => o.toLowerCase().includes(s) || s.includes(o.toLowerCase()))
}

/** Digit words for number plates: "oh" and "zero" are both 0, a lone "o" stays a letter. */
const PLATE_DIGITS = new Map<string, string>([
  ['zero', '0'], ['oh', '0'], ['one', '1'], ['two', '2'], ['three', '3'], ['four', '4'],
  ['five', '5'], ['six', '6'], ['seven', '7'], ['eight', '8'], ['nine', '9']
])

/**
 * Turns a spoken or typed vehicle number into plate format, grouping letters and digits:
 * "ka oh five mn four four seven one" becomes "KA 05 MN 4471".
 */
export function normalizePlate(text: string): string {
  const groups: { type: 'L' | 'D'; value: string }[] = []
  for (const token of text.toLowerCase().split(/[\s,.-]+/)) {
    if (!token) continue
    if (PLATE_DIGITS.has(token)) {
      pushGroup(groups, 'D', PLATE_DIGITS.get(token) ?? '')
      continue
    }
    for (const piece of token.match(/[a-z]+|\d+/g) ?? []) {
      if (/^\d+$/.test(piece)) pushGroup(groups, 'D', piece)
      else pushGroup(groups, 'L', piece)
    }
  }
  return groups.map((g) => g.value.toUpperCase()).join(' ')
}

function pushGroup(groups: { type: 'L' | 'D'; value: string }[], type: 'L' | 'D', value: string) {
  const last = groups[groups.length - 1]
  if (last && last.type === type) last.value += value
  else groups.push({ type, value })
}

/** Spoken number words one…ten become digits, so "gate one" becomes "gate 1". */
const NUMBER_WORDS = new Map<string, string>([
  ['one', '1'], ['two', '2'], ['three', '3'], ['four', '4'], ['five', '5'],
  ['six', '6'], ['seven', '7'], ['eight', '8'], ['nine', '9'], ['ten', '10']
])
export const digitWords = (text: string) =>
  text.toLowerCase().split(/\s+/).map((w) => NUMBER_WORDS.get(w) ?? w).join(' ').trim()

const WEIGHT_UNITS = new Set(['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms', 'kilogramme', 'kilogrammes'])

/**
 * A spoken weight in kilograms: "two five zero zero", "2500", "2500 kg" or "two five point five".
 * Returns undefined when the words are not all numbers, so "two thousand" is never guessed as 25.
 */
export function spokenNumber(text: string): string | undefined {
  const parts: string[] = []
  for (const raw of text.toLowerCase().split(/[\s,]+/)) {
    if (!raw || WEIGHT_UNITS.has(raw)) continue
    if (raw === 'point' || raw === 'dot') { parts.push('.'); continue }
    const digit = DIGIT_WORDS.get(raw) ?? (/^\d+(\.\d+)?$/.test(raw) ? raw : undefined)
    if (digit === undefined) return undefined
    parts.push(digit)
  }
  const value = parts.join('')
  return /^\d+(\.\d+)?$/.test(value) ? value : undefined
}
