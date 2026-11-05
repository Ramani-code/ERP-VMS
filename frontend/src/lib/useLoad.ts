import { useCallback, useEffect, useRef, useState } from 'react'

/** Loads live data, exposes reload(), and refreshes quietly on an interval. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = [], refreshMs = 0) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      setData(await fnRef.current())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!refreshMs) return
    const t = window.setInterval(() => { void reload(true) }, refreshMs)
    return () => window.clearInterval(t)
  }, [refreshMs, reload])

  return { data, error, loading, reload }
}
