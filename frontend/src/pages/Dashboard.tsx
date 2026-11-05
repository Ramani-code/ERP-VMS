import { useState } from 'react'
import PageHeading from '../components/PageHeading'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import PhotoThumb from '../components/PhotoThumb'
import { Alert, Empty, Spinner } from '../components/Feedback'
import { ClockIcon, DoorIcon, TruckIcon, UsersIcon } from '../components/icons'
import { api, photoUrl, todayIso } from '../lib/api'
import { useLoad } from '../lib/useLoad'
import type { AlertItem, Visitor } from '../types'

const elapsed = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`

/** Full details of one visitor, shown when a row in Today's Visitor Log is selected. */
function VisitorDetail({ v, onClose }: { v: Visitor; onClose: () => void }) {
  const items: [string, string | null | undefined][] = [
    ['Pass ID', v.passId],
    ['Mobile', v.phone],
    ['Email', v.email],
    ['Company', v.company],
    ['Purpose of visit', v.purpose],
    ['Host', v.host],
    ['Department', v.department],
    ['Gate', v.gate],
    ['Visit date', v.visitDate],
    ['Visit time', v.visitTime],
    ['Checked in', v.checkInTime],
    ['Checked out', v.checkOutTime],
    ['Status', v.status]
  ]
  return (
    <section className="panel" aria-label="Visitor details">
      <div className="panel-head">
        <div><h2>Visitor details</h2><p>{v.name}</p></div>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
      </div>
      <div className="panel-body" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'start' }}>
        <PhotoThumb src={photoUrl(v.id)} fallback={v.photoInitials} size={96} alt={`Photo of ${v.name}`} />
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, margin: 0 }}>
          {items.map(([label, value]) => (
            <div key={label}><dt className="eyebrow">{label}</dt><dd style={{ margin: 0 }}>{value || '—'}</dd></div>
          ))}
        </dl>
      </div>
    </section>
  )
}

export default function Dashboard() {
  const { data, error, loading, reload } = useLoad(async () => {
    const [stats, visitors, vehicles, alerts] = await Promise.all([
      api.dashboard(),
      api.visitors({ date: todayIso() }),
      api.vehicles(),
      api.alerts()
    ])
    return { stats, visitors, vehicles, alerts }
  }, [], 15000)

  const [busyKey, setBusyKey] = useState('')
  const [actionError, setActionError] = useState('')
  const [selectedId, setSelectedId] = useState('')

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusyKey(key); setActionError('')
    try { await fn(); await reload(true) }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Action failed') }
    finally { setBusyKey('') }
  }

  /** Visitors are checked out by pass number, vehicles by entry ID. */
  const checkOutAlert = (a: AlertItem) =>
    a.kind === 'VISITOR' ? api.checkOut(a.passOrVehicle) : api.vehicleExit(a.code)

  const deleteVisitor = (v: Visitor) => {
    if (!window.confirm(`Delete ${v.name} (${v.passId})? This removes the visit and its photo and cannot be undone.`)) return
    void run(`del-${v.id}`, async () => {
      await api.deleteVisitor(v.id)
      setSelectedId((cur) => (cur === v.id ? '' : cur))
    })
  }

  const stats = data?.stats
  const visitors = data?.visitors ?? []
  const vehicles = data?.vehicles ?? []
  const alerts = data?.alerts ?? []
  const selected = visitors.find((v) => v.id === selectedId) ?? null
  const maxDept = Math.max(...(stats?.departments.map((d) => d.visitors) ?? [0]), 1)

  return (
    <>
      <PageHeading title="Dashboard" subtitle="Live visitor, vehicle and gate activity for today"
        right={<span className="status-online">Monitor</span>} />
      <main className="page-main">
        {error && <Alert>{error}</Alert>}
        {actionError && <Alert>{actionError}</Alert>}
        {loading && !data ? <div className="panel"><Spinner /></div> : (
          <>
            <div className="stat-grid">
              <StatCard label="Visitors Today" value={stats?.visitorsToday ?? 0} hint="Registered for today" icon={<UsersIcon />} accent="#2563eb" />
              <StatCard label="Currently Inside" value={stats?.currentlyInside ?? 0} hint="Checked in, not yet out" icon={<DoorIcon />} accent="#15803d" />
              <StatCard label="Checked Out Today" value={stats?.checkedOutToday ?? 0} hint="Visitors who have left" icon={<ClockIcon />} accent="#b45309" />
              <StatCard label="Vehicles Logged" value={stats?.vehiclesLogged ?? 0} hint="Vehicle entries today" icon={<TruckIcon />} accent="#0d9488" />
            </div>

            <section className="panel" style={{ minWidth: 0 }}>
              <div className="panel-head">
                <div><h2>Overdue alerts</h2><p>Visitors and vehicles still inside: alert at 6 hours, escalated at 24 hours</p></div>
                <span className="eyebrow">{alerts.length} active</span>
              </div>
              <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
                {alerts.length === 0 ? <Empty title="No overdue check-outs">Every visitor and vehicle is within 6 hours.</Empty> : alerts.map((a) => (
                  <div key={a.key} className="overstay-card">
                    <div>
                      <strong>{a.kind === 'VISITOR' ? a.name : a.passOrVehicle}</strong>{' '}
                      <span className="mono">{a.kind === 'VISITOR' ? a.passOrVehicle : a.code}</span>
                      {' · '}{a.kind === 'VISITOR' ? 'Visitor' : 'Vehicle'} inside {elapsed(a.minutesInside)} (since {a.sinceTime})
                    </div>
                    <div style={{ fontSize: 13 }}>{a.message}</div>
                    <div>
                      <button className="btn btn-danger btn-sm" disabled={busyKey === a.key}
                        onClick={() => void run(a.key, () => checkOutAlert(a))}>
                        {a.kind === 'VISITOR' ? 'Check out visitor' : 'Log vehicle exit'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div><h2>Vehicle Log</h2><p>Today's vehicle movements with photo, driver and gate details</p></div>
                <span className="eyebrow">{vehicles.length} {vehicles.length === 1 ? 'entry' : 'entries'}</span>
              </div>
              {vehicles.length === 0 ? <Empty title="No vehicles logged today">Entries recorded under Vehicle Entry appear here.</Empty> : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Photo</th><th>Vehicle</th><th>Driver</th><th>Vendor</th><th>Material</th><th>Purpose</th><th>Gate</th><th>In</th><th>Out</th><th>Status</th></tr></thead>
                    <tbody>
                      {vehicles.map((v) => (
                        <tr key={v.id}>
                          <td><PhotoThumb src={photoUrl(v.id)} fallback="VH" size={48} alt={`Photo of vehicle ${v.vehicleNumber}`} /></td>
                          <td className="mono" style={{ fontWeight: 600 }}>{v.vehicleNumber}</td>
                          <td className="person-name">{v.driverName}</td>
                          <td>{v.vendor || '—'}</td><td>{v.material || '—'}</td><td>{v.purpose || '—'}</td><td>{v.gate}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{v.entryTime}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{v.exitTime ?? '—'}</td>
                          <td>{v.exitTime ? <span className="badge">Exited</span> : <span className="badge badge-green">Inside</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {selected && <VisitorDetail v={selected} onClose={() => setSelectedId('')} />}

            <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
              <section className="panel span-2" style={{ minWidth: 0 }}>
                <div className="panel-head">
                  <div><h2>Today's Visitor Log</h2><p>Every visitor registered for today. Select a row for full details.</p></div>
                  <span className="eyebrow">{visitors.length} {visitors.length === 1 ? 'entry' : 'entries'}</span>
                </div>
                {visitors.length === 0 ? (
                  <Empty title="No visitors yet today">New registrations will appear here instantly.</Empty>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Visitor</th><th>Host</th><th>Department</th><th>Visit time</th><th>In</th><th>Out</th><th>Status</th><th>Action</th></tr></thead>
                      <tbody>
                        {visitors.map((v) => (
                          <tr key={v.id}
                            tabIndex={0}
                            aria-selected={selectedId === v.id}
                            onClick={() => setSelectedId(v.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setSelectedId(v.id) }}
                            style={{ cursor: 'pointer', background: selectedId === v.id ? 'var(--blue-50)' : undefined }}>
                            <td><div className="person"><PhotoThumb src={photoUrl(v.id)} fallback={v.photoInitials} size={40} alt={`Photo of ${v.name}`} />
                              <div><div className="person-name">{v.name}</div><div className="person-sub">{v.company || '—'}</div></div></div></td>
                            <td>{v.host || '—'}</td>
                            <td>{v.department || '—'}</td>
                            <td className="mono">{v.visitTime}</td>
                            <td className="mono">{v.checkInTime ?? '—'}</td>
                            <td className="mono">{v.checkOutTime ?? '—'}</td>
                            <td><StatusBadge status={v.status} /></td>
                            <td>
                              <button className="btn btn-danger btn-sm" disabled={busyKey === `del-${v.id}`}
                                onClick={(e) => { e.stopPropagation(); deleteVisitor(v) }}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
              <section className="panel">
                <div className="panel-head"><div><h2>Visitor Distribution</h2><p>Today's visitors by department</p></div></div>
                <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
                  {(stats?.departments.length ?? 0) === 0 ? <Empty title="No data yet">Department split appears once visitors register.</Empty> :
                    (stats?.departments ?? []).map((d) => (
                      <div key={d.department}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                          <strong>{d.department}</strong><span className="muted">{d.visitors}</span>
                        </div>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${(d.visitors / maxDept) * 100}%` }} /></div>
                      </div>
                    ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head"><div><h2>Gate Activity</h2><p>Vehicle movement per gate today</p></div></div>
                <div className="panel-body" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                  {(stats?.gates ?? []).map((g) => (
                    <div key={g.gate} style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                      <div className="eyebrow">{g.gate}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginTop: 8 }}>{g.vehiclesToday}</div>
                      <div className="person-sub">{g.vehiclesInside} inside now</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </>
  )
}
