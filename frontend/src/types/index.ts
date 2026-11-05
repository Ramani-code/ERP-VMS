export type VisitorStatus =
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Checked In'
  | 'Checked Out'

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'RECEPTIONIST' | 'HOST' | 'SECURITY'

export interface User {
  id: number
  email: string
  fullName: string
  role: Role
}

export interface Visitor {
  id: string
  passId: string
  name: string
  company: string | null
  phone: string
  email: string | null
  purpose: string
  host: string | null
  department: string | null
  visitDate: string
  visitTime: string
  status: VisitorStatus
  checkInTime: string | null
  checkOutTime: string | null
  photoInitials: string
  gate: string | null
}

export interface VisitorProfile {
  id: number
  name: string
  phone: string
  email: string | null
  company: string | null
  lastHost: string | null
  lastDepartment: string | null
}

export interface VehicleEntry {
  id: string
  vehicleNumber: string
  driverName: string
  vendor: string | null
  material: string | null
  purpose: string | null
  gate: string
  entryTime: string
  exitTime: string | null
  loadWeight: number | null
}

export interface DashboardData {
  date: string
  visitorsToday: number
  currentlyInside: number
  checkedOutToday: number
  vehiclesLogged: number
  departments: { department: string; visitors: number }[]
  gates: { gate: string; vehiclesToday: number; vehiclesInside: number }[]
}

export interface RegistrationPayload {
  name: string
  mobile: string
  email: string
  company: string
  purpose: string
  host: string
  department: string
  gate: string
  visitDate: string
  visitTime: string
  /** JPEG data URL from the camera, or empty. */
  photo: string
}

export interface VehiclePayload {
  vehicleNumber: string
  driverName: string
  vendor: string
  material: string
  purpose: string
  gate: string
  /** Load weight in kilograms, as typed. Empty when not weighed. */
  loadWeight: string
  /** JPEG data URL from the camera, or empty. */
  photo: string
}

/** A visitor or vehicle still inside after 6 hours (level 6H) or 24 hours (level 24H). */
export interface AlertItem {
  key: string
  kind: 'VISITOR' | 'VEHICLE'
  level: '6H' | '24H'
  /** Pass ID for visitors, vehicle entry ID for vehicles. */
  code: string
  /** Pass ID for visitors, vehicle number for vehicles. */
  passOrVehicle: string
  name: string
  detail: string
  sinceTime: string
  minutesInside: number
  message: string
}

/** One row of today's check-in / check-out history. */
export interface CheckpointLogEntry {
  kind: 'VISITOR' | 'VEHICLE'
  /** Pass ID for visitors, vehicle entry ID for vehicles. */
  code: string
  name: string
  detail: string
  place: string
  inTime: string
  outTime: string | null
  status: string
  minutesInside: number
  overdue: boolean
}

export interface VehicleLog {
  id: string
  vehicleNumber: string
  driverName: string
  vendor: string | null
  material: string | null
  purpose: string | null
  gate: string
  entryDate: string
  entryTime: string
  exitDate: string | null
  exitTime: string | null
  duration: string | null
  loadWeight: string | null
  status: 'Inside' | 'Exited'
}
