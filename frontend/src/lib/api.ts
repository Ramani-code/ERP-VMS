import type {
  AlertItem, CheckpointLogEntry, DashboardData, RegistrationPayload, VehicleEntry, VehicleLog,
  VehiclePayload, Visitor, VisitorProfile
} from '../types'

export const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}, raw = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError('Cannot reach the server. Check that the backend is running.', 0)
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.message) message = body.message
    } catch { /* body was not JSON */ }
    throw new ApiError(message, res.status)
  }
  if (raw) return (await res.blob()) as T
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const qs = (params: Record<string, string | undefined>) => {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v) })
  const s = p.toString()
  return s ? `?${s}` : ''
}

const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export type VisitorFilters = {
  name?: string
  department?: string
  status?: string
  date?: string
  from?: string
  to?: string
}

export type VehicleLogFilters = {
  from?: string
  to?: string
  q?: string
  gate?: string
  status?: string
}

export const api = {
  dashboard: () => request<DashboardData>('/dashboard'),
  alerts: () => request<AlertItem[]>('/alerts'),
  checkpointLog: (date: string) => request<CheckpointLogEntry[]>(`/checkpoint/log${qs({ date })}`),
  departments: () => request<string[]>('/departments'),
  gates: () => request<string[]>('/gates'),

  visitors: (f: VisitorFilters = {}) =>
    request<Visitor[]>(`/visitors${qs(f)}`),
  searchProfiles: (q: string) => request<VisitorProfile[]>(`/visitors/profiles/search${qs({ q })}`),
  register: (p: RegistrationPayload) =>
    post<Visitor>('/visitors', {
      ...p,
      email: p.email || null,
      company: p.company || null,
      host: p.host || null,
      department: p.department || null,
      photo: p.photo || null
    }),
  approve: (code: string) => post<Visitor>(`/visitors/${encodeURIComponent(code)}/approve`),
  reject: (code: string) => post<Visitor>(`/visitors/${encodeURIComponent(code)}/reject`),
  reschedule: (code: string, visitDate: string, visitTime: string) =>
    post<Visitor>(`/visitors/${encodeURIComponent(code)}/reschedule`, { visitDate, visitTime }),
  deleteVisitor: (code: string) =>
    request<void>(`/visitors/${encodeURIComponent(code)}`, { method: 'DELETE' }),
  passLookup: (passId: string) => request<Visitor>(`/visitors/pass/${encodeURIComponent(passId)}`),
  checkIn: (passId: string) => post<Visitor>(`/visitors/pass/${encodeURIComponent(passId)}/check-in`),
  checkOut: (passId: string) => post<Visitor>(`/visitors/pass/${encodeURIComponent(passId)}/check-out`),

  vehicles: (date?: string) => request<VehicleEntry[]>(`/vehicles${qs({ date })}`),
  addVehicle: (p: VehiclePayload) =>
    post<VehicleEntry>('/vehicles', {
      ...p,
      vendor: p.vendor || null,
      material: p.material || null,
      purpose: p.purpose || null,
      loadWeight: p.loadWeight ? Number(p.loadWeight) : null,
      photo: p.photo || null
    }),
  vehicleExit: (code: string) => post<VehicleEntry>(`/vehicles/${encodeURIComponent(code)}/exit`),

  reportCsv: (f: VisitorFilters) =>
    request<Blob>(`/reports/visitors.csv${qs(f)}`, {}, true),

  vehicleLogs: (f: VehicleLogFilters) => request<VehicleLog[]>(`/reports/vehicles${qs(f)}`),
  vehicleLogsCsv: (f: VehicleLogFilters) => request<Blob>(`/reports/vehicles.csv${qs(f)}`, {}, true)
}

/** URL of a stored camera photo (visit code or vehicle entry code). */
export const photoUrl = (code: string) => `${BASE}/photos/${encodeURIComponent(code)}`

/** Local calendar date as yyyy-mm-dd (not UTC). */
export const todayIso = () => {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
