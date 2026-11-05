import { Outlet } from 'react-router-dom'
import Topbar from './Topbar'

export default function Layout() {
  return (
    <div className="app-shell">
      <Topbar />
      <div className="route-content"><Outlet /></div>
      <footer className="app-footer">
        © {new Date().getFullYear()} Zyger Technology · Smart Visitor Management System
      </footer>
    </div>
  )
}
