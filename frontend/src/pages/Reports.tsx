import { useEffect, useState } from 'react'
import PageHeading from '../components/PageHeading'
import StatusBadge from '../components/StatusBadge'
import { Alert, Empty, Spinner } from '../components/Feedback'
import { ACCESS, useAuth } from '../lib/auth'
import { api, todayIso } from '../lib/api'
import { buildTablePdf } from '../lib/pdf'
import { useLoad } from '../lib/useLoad'
import type { VehicleLog, Visitor } from '../types'

const STATUSES = ['Pending Approval', 'Approved', 'Rejected', 'Checked In', 'Checked Out']
const VEHICLE_STATES = ['Inside', 'Exited']

const VISITOR_COLUMNS = ['Pass ID', 'Visitor', 'Company', 'Host', 'Department', 'Gate', 'Visit Date', 'Visit Time', 'Check-In', 'Check-Out', 'Status']
const VEHICLE_COLUMNS = ['Entry ID', 'Vehicle No', 'Driver', 'Vendor', 'Material', 'Load (kg)', 'Purpose', 'Gate', 'Entry Date', 'Entry Time', 'Exit Date', 'Exit Time', 'Duration', 'Status']

const visitorRow = (v: Visitor): string[] => [
  v.passId, v.name, v.company ?? '', v.host ?? '', v.department ?? '', v.gate ?? '',
  v.visitDate, v.visitTime, v.checkInTime ?? '', v.checkOutTime ?? '', v.status
]

const vehicleRow = (v: VehicleLog): string[] => [
  v.id, v.vehicleNumber, v.driverName, v.vendor ?? '', v.material ?? '', v.loadWeight ?? '', v.purpose ?? '',
  v.gate, v.entryDate, v.entryTime, v.exitDate ?? '', v.exitTime ?? '', v.duration ?? '', v.status
]

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The same day-of-month, n months ago (clamped to the month's length). */
function monthsAgo(n: number): Date {
  const d = new Date()
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return d
}

const dayAfter = (d: Date) => {
  const x = new Date(d)
  x.setDate(x.getDate() + 1)
  return x
}

/** Dropdown periods. Each one ends today and includes today. */
const PERIODS = {
  custom: { label: 'Custom dates', start: null },
  week: { label: 'Last 1 week', start: () => { const d = new Date(); d.setDate(d.getDate() - 6); return d } },
  month: { label: 'Last 1 month', start: () => dayAfter(monthsAgo(1)) },
  quarter: { label: 'Last 3 months', start: () => dayAfter(monthsAgo(3)) }
} as const
type PeriodKey = keyof typeof PERIODS

function periodRange(key: Exclude<PeriodKey, 'custom'>) {
  return { from: isoOf(PERIODS[key].start()), to: isoOf(new Date()) }
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke later: revoking at once can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Dropdown for quick periods, plus From and To dates. Editing a date switches the dropdown to Custom. */
function PeriodControls({ period, from, to, onPeriod, onDates }: {
  period: PeriodKey
  from: string
  to: string
  onPeriod: (p: PeriodKey, from: string, to: string) => void
  onDates: (from: string, to: string) => void
}) {
  return (
    <>
      <label><span className="eyebrow field-label">Period</span>
        <select className="input" style={{ width: 190 }} value={period}
          onChange={(e) => {
            const p = e.target.value as PeriodKey
            if (p === 'custom') return onPeriod(p, from, to)
            const r = periodRange(p)
            onPeriod(p, r.from, r.to)
          }}>
          {(Object.keys(PERIODS) as PeriodKey[]).map((k) => <option key={k} value={k}>{PERIODS[k].label}</option>)}
        </select>
      </label>
      <label><span className="eyebrow field-label">From</span>
        <input className="input" style={{ width: 160 }} type="date" value={from} max={to || undefined}
          onChange={(e) => onDates(e.target.value, to)} /></label>
      <label><span className="eyebrow field-label">To</span>
        <input className="input" style={{ width: 160 }} type="date" value={to} min={from || undefined}
          onChange={(e) => onDates(from, e.target.value)} /></label>
    </>
  )
}

function VisitorReport() {
  const departments = useLoad(() => api.departments())
  const [name, setName] = useState('')
  const [debouncedName, setDebouncedName] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [period, setPeriod] = useState<PeriodKey>('custom')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedName(name), 300)
    return () => window.clearTimeout(t)
  }, [name])

  const rangeInvalid = !!from && !!to && to < from
  // A start date with no end date means "from that day until today".
  const effectiveTo = to || (from ? todayIso() : '')
  const filters = { name: debouncedName, department, status, from, to: effectiveTo }
  const { data, error, loading } = useLoad(
    () => (rangeInvalid ? Promise.resolve([] as Visitor[]) : api.visitors(filters)),
    [debouncedName, department, status, from, effectiveTo, rangeInvalid]
  )
  const rows = data ?? []
  const label = `${from || 'start'}_to_${effectiveTo || 'today'}`
  const period_text = `${from || 'all'} to ${effectiveTo || 'today'}`

  const exportCsv = async () => {
    setExportError('')
    try { saveBlob(await api.reportCsv(filters), `visitor-report-${label}.csv`) }
    catch (e) { setExportError(e instanceof Error ? e.message : 'Export failed') }
  }

  const exportPdf = () => {
    setExportError('')
    saveBlob(buildTablePdf({
      title: 'Visitor Log',
      subtitle: `Period: ${period_text}   |   ${rows.length} records`,
      headers: VISITOR_COLUMNS,
      rows: rows.map(visitorRow)
    }), `visitor-report-${label}.pdf`)
  }



  const filtered = !!(debouncedName || department || status || from || to)

  return (
    <>
      <div className="panel panel-body no-print" style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
          <label><span className="eyebrow field-label">Visitor name</span><input className="input" style={{ width: 180 }} placeholder="Search…" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label><span className="eyebrow field-label">Department</span>
            <select className="input" style={{ width: 170 }} value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All</option>{(departments.data ?? []).map((d) => <option key={d}>{d}</option>)}
            </select></label>
          <label><span className="eyebrow field-label">Status</span>
            <select className="input" style={{ width: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select></label>
          <PeriodControls period={period} from={from} to={to}
            onPeriod={(p, f, t) => { setPeriod(p); setFrom(f); setTo(t) }}
            onDates={(f, t) => { setPeriod('custom'); setFrom(f); setTo(t) }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-secondary" disabled={rangeInvalid || rows.length === 0} onClick={exportPdf}>Download PDF</button>
          <button className="btn btn-secondary" disabled={rangeInvalid} onClick={() => void exportCsv()}>Export Excel (CSV)</button>
                  </div>
      </div>
      {rangeInvalid && <Alert>The “To” date cannot be before the “From” date.</Alert>}
      {(error || exportError) && <Alert>{error || exportError}</Alert>}

      <section className="panel">
        <div className="panel-head">
          <h2>Visitor log</h2>
          <span className="eyebrow">{rows.length} records{from || to ? ` · ${period_text}` : ''}</span>
        </div>
        {loading && !data ? <Spinner /> : rows.length === 0 ? (
          <Empty title="No visitors match these filters">
            {filtered ? <p className="muted">Clear a filter or pick a wider period.</p> : <p className="muted">No visits have been registered yet. Add one under Visitor Registration and it will appear here.</p>}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Pass</th><th>Visitor</th><th>Company</th><th>Host</th><th>Department</th><th>Gate</th><th>Visit</th><th>In</th><th>Out</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td className="mono" style={{ fontSize: 12 }}>{v.passId}</td>
                    <td className="person-name">{v.name}</td><td>{v.company || '—'}</td><td>{v.host || '—'}</td><td>{v.department || '—'}</td>
                    <td>{v.gate || '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{v.visitDate} {v.visitTime}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{v.checkInTime ?? '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{v.checkOutTime ?? '—'}</td>
                    <td><StatusBadge status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function VehicleReport() {
  const gates = useLoad(() => api.gates())
  const [period, setPeriod] = useState<PeriodKey>('custom')
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [gate, setGate] = useState('')
  const [status, setStatus] = useState('')
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 300)
    return () => window.clearTimeout(t)
  }, [q])

  const rangeInvalid = !!from && !!to && to < from
  const filters = { from, to, q: debouncedQ, gate, status }
  const { data, error, loading } = useLoad(
    () => (rangeInvalid ? Promise.resolve([] as VehicleLog[]) : api.vehicleLogs(filters)),
    [from, to, debouncedQ, gate, status, rangeInvalid]
  )
  const rows = data ?? []
  const inside = rows.filter((r) => r.status === 'Inside').length
  const label = `${from || 'start'}_to_${to || 'today'}`

  const exportCsv = async () => {
    setExportError('')
    try { saveBlob(await api.vehicleLogsCsv(filters), `vehicle-log-${label}.csv`) }
    catch (e) { setExportError(e instanceof Error ? e.message : 'Export failed') }
  }

  const exportPdf = () => {
    setExportError('')
    saveBlob(buildTablePdf({
      title: 'Vehicle Logs',
      subtitle: `Period: ${from || 'all'} to ${to || 'today'}   |   ${rows.length} records, ${inside} inside`,
      headers: VEHICLE_COLUMNS,
      rows: rows.map(vehicleRow)
    }), `vehicle-log-${label}.pdf`)
  }

  return (
    <>
      <div className="panel panel-body no-print" style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
          <label><span className="eyebrow field-label">Vehicle / driver</span><input className="input" style={{ width: 180 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <PeriodControls period={period} from={from} to={to}
            onPeriod={(p, f, t) => { setPeriod(p); setFrom(f); setTo(t) }}
            onDates={(f, t) => { setPeriod('custom'); setFrom(f); setTo(t) }} />
          <label><span className="eyebrow field-label">Gate</span>
            <select className="input" style={{ width: 170 }} value={gate} onChange={(e) => setGate(e.target.value)}>
              <option value="">All</option>{(gates.data ?? []).map((g) => <option key={g}>{g}</option>)}
            </select></label>
          <label><span className="eyebrow field-label">Status</span>
            <select className="input" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>{VEHICLE_STATES.map((s) => <option key={s}>{s}</option>)}
            </select></label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-secondary" disabled={rangeInvalid || rows.length === 0} onClick={exportPdf}>Download PDF</button>
          <button className="btn btn-secondary" disabled={rangeInvalid} onClick={() => void exportCsv()}>Export Excel (CSV)</button>
        </div>
      </div>
      {rangeInvalid && <Alert>The “To” date cannot be before the “From” date.</Alert>}
      {(error || exportError) && <Alert>{error || exportError}</Alert>}

      <section className="panel">
        <div className="panel-head">
          <h2>Vehicle logs</h2>
          <span className="eyebrow">{rows.length} records · {inside} inside</span>
        </div>
        {loading && !data ? <Spinner /> : rows.length === 0 ? (
          <Empty title="No vehicle logs match these filters">
            <p className="muted">Showing {from || '…'} to {to || '…'}. Choose a wider period, or log a vehicle under Vehicle Entry.</p>
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Entry</th><th>Vehicle</th><th>Driver</th><th>Vendor</th><th>Material</th><th>Load</th><th>Purpose</th><th>Gate</th><th>In</th><th>Out</th><th>Duration</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td className="mono" style={{ fontSize: 12 }}>{v.id}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{v.vehicleNumber}</td>
                    <td className="person-name">{v.driverName}</td>
                    <td>{v.vendor || '—'}</td><td>{v.material || '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{v.loadWeight ? `${v.loadWeight} kg` : '—'}</td>
                    <td>{v.purpose || '—'}</td><td>{v.gate}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{v.entryDate} {v.entryTime}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{v.exitDate ? `${v.exitDate} ${v.exitTime}` : '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{v.duration ?? '—'}</td>
                    <td>{v.status === 'Inside' ? <span className="badge badge-green">Inside</span> : <span className="badge">Exited</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

type Tab = 'visitors' | 'vehicles'

export default function Reports() {
  const { can } = useAuth()
  const [tab, setTab] = useState<Tab>('visitors')

  if (!can(...ACCESS.reports)) {
    return <><PageHeading title="Reports" /><main className="page-main"><Alert>Reports are available to Admin and Super Admin roles.</Alert></main></>
  }

  return (
    <>
      <PageHeading
        title="Reports"
        subtitle={tab === 'visitors' ? 'Filter the visitor log by period and download it' : 'Review gate vehicle movements by period and download them'}
      />
      <main className="page-main">
        <div className="report-tabs no-print" role="tablist" aria-label="Report type">
          <button role="tab" aria-selected={tab === 'visitors'} className={`report-tab ${tab === 'visitors' ? 'active' : ''}`} onClick={() => setTab('visitors')}>Visitor log</button>
          <button role="tab" aria-selected={tab === 'vehicles'} className={`report-tab ${tab === 'vehicles' ? 'active' : ''}`} onClick={() => setTab('vehicles')}>Vehicle logs</button>
        </div>
        {tab === 'visitors' ? <VisitorReport /> : <VehicleReport />}
      </main>
    </>
  )
}
