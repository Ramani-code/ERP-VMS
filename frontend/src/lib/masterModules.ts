import type { ReactElement } from 'react'
import { ClockIcon, DoorIcon, ReportIcon, TruckIcon, UsersIcon } from '../components/icons'

/**
 * Single source of truth for the Master module list.
 * The Topbar "Master" dropdown and the Master page tab bar both read from here,
 * so they can never drift apart.
 */
export type MasterViewId = 'visitor-registration' | 'approval' | 'check-in-out' | 'vehicle-entry' | 'report'

export interface MasterModule {
  id: MasterViewId
  label: string
  description: string
  icon: () => ReactElement
}

export const MASTER_MODULES: MasterModule[] = [
  { id: 'visitor-registration', label: 'Visitor Registration', description: 'Register visitors and issue passes', icon: UsersIcon },
  { id: 'approval', label: 'Approval', description: 'Approve, reject or reschedule visits', icon: ClockIcon },
  { id: 'check-in-out', label: 'Check In / Out', description: 'Gate check-in and check-out by pass', icon: DoorIcon },
  { id: 'vehicle-entry', label: 'Vehicle Entry', description: 'Log vehicles in and out per gate', icon: TruckIcon },
  { id: 'report', label: 'Report', description: 'Visitor and vehicle logs with export', icon: ReportIcon },
]

export const DEFAULT_MASTER_VIEW: MasterViewId = 'visitor-registration'

export const isMasterView = (value: string | null): value is MasterViewId =>
  MASTER_MODULES.some((m) => m.id === value)

export const masterPath = (id: MasterViewId) => `/master?view=${id}`
