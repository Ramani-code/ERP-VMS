import type { ComponentType } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeading from '../components/PageHeading'
import { Alert } from '../components/Feedback'
import { ACCESS, useAuth } from '../lib/auth'
import { DEFAULT_MASTER_VIEW, MASTER_MODULES, isMasterView, masterPath, type MasterViewId } from '../lib/masterModules'
import VisitorRegistration from './VisitorRegistration'
import VisitorApproval from './VisitorApproval'
import QRCheckInOut from './QRCheckInOut'
import VehicleEntryPage from './VehicleEntry'
import Reports from './Reports'

/** The real screen for each master module. */
const MODULE_PAGES: Record<MasterViewId, ComponentType> = {
  'visitor-registration': VisitorRegistration,
  approval: VisitorApproval,
  'check-in-out': QRCheckInOut,
  'vehicle-entry': VehicleEntryPage,
  report: Reports,
}

export default function Master() {
  const { can } = useAuth()
  const [searchParams] = useSearchParams()

  if (!can(...ACCESS.master)) {
    return (
      <>
        <PageHeading title="Master" />
        <main className="page-main">
          <Alert>Master modules are available to Admin and Super Admin roles.</Alert>
        </main>
      </>
    )
  }

  // The view comes from ?view=… (set by the Topbar "Master" dropdown or the tab bar).
  const raw = searchParams.get('view')
  const view: MasterViewId = isMasterView(raw) ? raw : DEFAULT_MASTER_VIEW
  const ModulePage = MODULE_PAGES[view]

  return (
    <>
      <nav className="master-tabs" aria-label="Master modules">
        {MASTER_MODULES.map((m) => {
          const Icon = m.icon
          const isActive = m.id === view
          return (
            <Link
              key={m.id}
              to={masterPath(m.id)}
              className={`master-tab ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon />
              {m.label}
            </Link>
          )
        })}
      </nav>

      {/* key forces a fresh form/state when switching modules */}
      <ModulePage key={view} />
    </>
  )
}
