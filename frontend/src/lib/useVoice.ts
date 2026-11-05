import { useCallback, useEffect, useRef, useState } from 'react'
import type { VoiceLang } from './voice'

// The Web Speech API is not in every TypeScript DOM lib, so its shape is declared here.
interface RecognitionAlternative { readonly transcript: string }
interface RecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: RecognitionAlternative
}
interface RecognitionEvent {
  readonly resultIndex: number
  readonly results: ArrayLike<RecognitionResult>
}
interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => RecognitionLike

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const ERROR_TEXT: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow the microphone for this site (lock icon in the address bar) and try again.',
  'service-not-allowed': 'Speech recognition is blocked by the browser for this site.',
  'audio-capture': 'No microphone was found. Connect a microphone and try again.',
  network: 'The speech service could not be reached. Voice input needs an internet connection.',
  'language-not-supported': 'This browser cannot listen in the selected language. Choose another language.'
}

/** Browsers stop listening after a pause; the hook restarts them while the user still wants to speak. */
const MAX_RESTARTS = 40

/**
 * Continuous speech capture. The transcript keeps growing until the user presses stop,
 * so a visitor can speak all the details in one go. Works in Chrome and Edge.
 */
export function useVoice() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')

  const recognizer = useRef<RecognitionLike | null>(null)
  const wantListening = useRef(false)
  const finalText = useRef('')
  const lang = useRef<VoiceLang>('en-IN')
  const restarts = useRef(0)
  const launchRef = useRef<() => void>(() => {})

  useEffect(() => () => {
    wantListening.current = false
    recognizer.current?.abort()
  }, [])

  const fail = useCallback((message: string) => {
    wantListening.current = false
    recognizer.current = null
    setListening(false)
    setError(message)
  }, [])

  const launch = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      fail('Voice input needs Google Chrome or Microsoft Edge.')
      return
    }
    const rec = new Ctor()
    rec.lang = lang.current
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      restarts.current = 0
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) finalText.current += `${result[0].transcript.trim()} `
        else interim += result[0].transcript
      }
      setTranscript(`${finalText.current}${interim}`.replace(/\s+/g, ' ').trim())
    }
    rec.onerror = (e) => {
      // 'no-speech' and 'aborted' are normal pauses; the session restarts itself.
      if (e.error === 'no-speech' || e.error === 'aborted') return
      fail(ERROR_TEXT[e.error] ?? `Voice input stopped (${e.error}). Press Start to try again.`)
    }
    rec.onend = () => {
      recognizer.current = null
      if (wantListening.current && restarts.current < MAX_RESTARTS) {
        restarts.current += 1
        launchRef.current()
        return
      }
      wantListening.current = false
      setListening(false)
    }

    recognizer.current = rec
    try {
      rec.start()
    } catch {
      fail('Could not start the microphone. Press Start to try again.')
    }
  }, [fail])

  useEffect(() => { launchRef.current = launch }, [launch])

  const start = useCallback((language: VoiceLang) => {
    if (wantListening.current) return
    if (!getRecognitionCtor()) {
      setError('Voice input needs Google Chrome or Microsoft Edge.')
      return
    }
    lang.current = language
    finalText.current = ''
    restarts.current = 0
    wantListening.current = true
    setError('')
    setTranscript('')
    setListening(true)
    launch()
  }, [launch])

  const stop = useCallback(() => {
    wantListening.current = false
    setListening(false)
    recognizer.current?.stop()
  }, [])

  return {
    listening,
    transcript,
    setTranscript,
    error,
    start,
    stop,
    supported: getRecognitionCtor() !== null
  }
}
