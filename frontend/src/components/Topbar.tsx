import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ACCESS, useAuth } from '../lib/auth'
import NotificationBell from './NotificationBell'
import { DEFAULT_MASTER_VIEW, MASTER_MODULES, isMasterView, masterPath } from '../lib/masterModules'
import './master.css'

const MENU_WIDTH = 290

/** "Master" item in the top navigation that opens a dropdown of the master modules. */
function MasterMenu() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: MENU_WIDTH })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const onMaster = location.pathname.startsWith('/master')
  const currentView = new URLSearchParams(location.search).get('view')
  const activeView = isMasterView(currentView) ? currentView : DEFAULT_MASTER_VIEW

  // Close the menu whenever the user navigates somewhere.
  useEffect(() => { setOpen(false) }, [location.pathname, location.search])

  // Close on outside click, Escape or window resize while open.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (!btnRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const toggle = () => {
    if (!open && btnRef.current) {
      // Keep the menu fully inside the viewport, even on narrow phone screens.
      const r = btnRef.current.getBoundingClientRect()
      const width = Math.min(MENU_WIDTH, window.innerWidth - 16)
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
      setPos({ top: r.bottom + 4, left, width })
    }
    setOpen((v) => !v)
  }

  return (
    <div className="master-menu">
      <button
        ref={btnRef}
        type="button"
        className={`nav-dropdown-btn ${onMaster ? 'active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        Master
        <span className="caret" aria-hidden="true" />
      </button>

      {open && (
        <div ref={menuRef} className="nav-dropdown-menu" role="menu" style={{ top: pos.top, left: pos.left, width: pos.width }}>
          <div className="nav-dropdown-head">Visitor Management Modules</div>
          {MASTER_MODULES.map((m) => {
            const Icon = m.icon
            const isActive = onMaster && activeView === m.id
            return (
              <Link
                key={m.id}
                to={masterPath(m.id)}
                role="menuitem"
                className={`nav-dropdown-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-dropdown-icon"><Icon /></span>
                <span>
                  <strong>{m.label}</strong>
                  <small>{m.description}</small>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Topbar() {
  const { user, can } = useAuth()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const otherLinks = [
    { to: '/registration', label: 'Visitor Registration', show: can(...ACCESS.registration) },
    { to: '/approvals', label: 'Approval', show: can(...ACCESS.approvals) },
    { to: '/checkpoint', label: 'Check In / Out', show: can(...ACCESS.checkpoint) },
    { to: '/vehicles', label: 'Vehicle Entry', show: true },
    { to: '/reports', label: 'Report', show: can(...ACCESS.reports) }
  ].filter((l) => l.show)

  const initials = (user?.fullName ?? 'U').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <header className="app-header">
        <div className="brand-block">
          <img src="/resource/zyger-mark.png" alt="Zyger Technology" className="brand-logo" />
          <div>
            <div className="brand-name">Zyger Technology</div>
            <div className="brand-subtitle">Smart Visitor Management</div>
          </div>
        </div>
        <div className="header-actions">
          <NotificationBell />
          <div className="header-clock">
            <span>{now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <strong>{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong>
          </div>
          <div className="profile-button" style={{ cursor: 'default' }} aria-label={`Signed in at the front desk: ${user?.fullName ?? ''}`}>
            <span className="avatar">{initials}</span>
            <span className="profile-text">
              <strong>{user?.fullName}</strong>
              <small>Front desk</small>
            </span>
          </div>
        </div>
      </header>
      <nav className="nav-row" aria-label="Primary navigation">
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          Dashboard
        </NavLink>
        {can(...ACCESS.master) && <MasterMenu />}
        {otherLinks.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
