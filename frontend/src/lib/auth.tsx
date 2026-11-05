import type { Role, User } from '../types'

/**
 * Sign-in has been removed. Every screen is open, so the header shows a fixed
 * front-desk operator and every module is available.
 */
const DESK_USER: User = { id: 0, email: 'front-desk@zyger.com', fullName: 'Front Desk', role: 'SUPER_ADMIN' }

export function useAuth() {
  return {
    user: DESK_USER,
    can: (..._roles: Role[]): boolean => true
  }
}

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrator',
  RECEPTIONIST: 'Receptionist',
  HOST: 'Host',
  SECURITY: 'Security'
}

/** Which modules each role may use. Kept for reference; with sign-in removed every module is open. */
export const ACCESS: Record<string, Role[]> = {
  registration: ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'HOST'],
  approvals: ['SUPER_ADMIN', 'ADMIN', 'HOST'],
  checkpoint: ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'SECURITY'],
  vehicleWrite: ['SUPER_ADMIN', 'ADMIN', 'SECURITY'],
  reports: ['SUPER_ADMIN', 'ADMIN'],
  master: ['SUPER_ADMIN', 'ADMIN']
}
