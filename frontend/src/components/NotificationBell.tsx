import { useEffect, useRef, useState } from 'react'
import { BellIcon } from './icons'
import { api } from '../lib/api'
import { useLoad } from '../lib/useLoad'

/** Alerts the desk has already read are remembered in this browser only. */
const READ_KEY = 'vms.alerts.read'

function loadRead(): Set<string> {
  try {
    const raw = window.localStorage.getItem(READ_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveRead(read: Set<string>) {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify([...read].slice(-500)))
  } catch { /* storage unavailable: alerts simply show as unread again */ }
}

/** Bell in the header: 6-hour and 24-hour alerts for visitors and vehicles not checked out. */
export default function NotificationBell() {
  const alerts = useLoad(() => api.alerts(), [], 30000)
  const [open, setOpen] = useState(false)
  const [read, setRead] = useState<Set<string>>(() => loadRead())
  const wrap = useRef<HTMLDivElement>(null)
  const items = alerts.data ?? []
  const unread = items.filter((a) => !read.has(a.key)).length

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const markRead = (key: string) => {
    const next = new Set(read).add(key)
    saveRead(next)
    setRead(next)
  }

  const markAll = () => {
    const next = new Set(read)
    items.forEach((a) => next.add(a.key))
    saveRead(next)
    setRead(next)
  }

  return (
    <div className="bell-wrap" ref={wrap}>
      <button
        type="button"
        className={`bell-btn ${unread > 0 ? 'has-unread' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `${unread} unread alerts` : 'Alerts'}
      >
        <BellIcon />
        {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-menu" role="menu">
          <div className="bell-head">
            <strong>Alerts</strong>
            <button type="button" onClick={markAll} disabled={unread === 0}>Mark all read</button>
          </div>
          {items.length === 0 ? (
            <div className="bell-empty">No visitors or vehicles are overdue for check-out.</div>
          ) : (
            <div className="bell-list">
              {items.map((a) => (
                <button
                  type="button"
                  key={a.key}
                  className={`bell-item ${read.has(a.key) ? '' : 'unread'}`}
                  onClick={() => markRead(a.key)}
                >
                  <span className="bell-item-title">
                    {a.level === '24H' ? '24-hour alert' : '6-hour alert'} · {a.kind === 'VISITOR' ? 'Visitor' : 'Vehicle'}
                  </span>
                  <span className="bell-item-msg">{a.message}</span>
                  <span className="bell-item-time">Since {a.sinceTime}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
