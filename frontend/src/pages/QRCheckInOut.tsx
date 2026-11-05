import { useState } from 'react'
import PageHeading from '../components/PageHeading'
import StatusBadge from '../components/StatusBadge'
import QrScanner from '../components/QrScanner'
import PhotoThumb from '../components/PhotoThumb'
import { Alert, Empty, Spinner } from '../components/Feedback'
import { ACCESS, useAuth } from '../lib/auth'
import { api, photoUrl, todayIso } from '../lib/api'
import { useLoad } from '../lib/useLoad'
import type { AlertItem, CheckpointLogEntry, Visitor } from '../types'

/** Pass numbers look like QR-2026-0001. A scan may return extra text, so the number is picked out of it. */
const extractPassId = (text: string): string => {
  const m = text.match(/QR-\d{4}-\d{4}/i)
  return (m ? m[0] : text).trim().toUpperCase()
}

export default function QRCheckInOut() {
  const { can } = useAuth()
  const today = todayIso()
  const log = useLoad(() => api.checkpointLog(today), [], 10000)
  const alerts = useLoad(() => api.alerts(), [], 20000)
  const expected = useLoad(() => api.visitors({ date: today }), [], 20000)

  const [passInput, setPassInput] = useState('')
  const [found, setFound] = useState<Visitor | null>(null)
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)

  const refreshAll = () => {
    void log.reload(true)
    void alerts.reload(true)
    void expected.reload(true)
  }

  const lookup = async (raw: string) => {
    const id = extractPassId(raw)
    if (!id) return
    setPassInput(id)
    setBusy(true); setMessage(''); setOk('')
    try { setFound(await api.passLookup(id)) }
    catch (e) { setFound(null); setMessage(e instanceof Error ? e.message : 'Lookup failed') }
    finally { setBusy(false) }
  }

  const onScan = (text: string) => {
    setScanning(false)
    void lookup(text)
  }

  const act = async (action: 'in' | 'out') => {
    if (!found) return
    setBusy(true); setMessage(''); setOk('')
    try {
      const updated = action === 'in' ? await api.checkIn(found.passId) : await api.checkOut(found.passId)
      setFound(updated)
      setOk(action === 'in' ? `${updated.name} checked in.` : `${updated.name} checked out.`)
      refreshAll()
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Action failed') }
    finally { setBusy(false) }
  }

  const exitVehicle = async (code: string) => {
    setBusy(true); setMessage(''); setOk('')
    try {
      await api.vehicleExit(code)
      setOk(`Vehicle ${code} exit logged.`)
      refreshAll()
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not log the exit') }
    finally { setBusy(false) }
  }

  if (!can(...ACCESS.checkpoint)) {
    return <><PageHeading title="Check In / Out" /><main className="page-main"><Alert>Your role cannot operate the gate check-point.</Alert></main></>
  }

  const alertFor = (a: AlertItem) => a.kind === 'VISITOR' && a.passOrVehicle === found?.passId
  const foundAlert = (alerts.data ?? []).find(alertFor)
  const waiting = (expected.data ?? []).filter((v) => v.status === 'Approved')
  const rows: CheckpointLogEntry[] = log.data ?? []
  const vehiclesInside = rows.filter((r) => r.kind === 'VEHICLE' && r.status === 'Inside')

  return (
    <>
      <PageHeading title="Check In / Out" subtitle="Scan or type the pass number to admit or release a visitor. Today's movements are listed below." />
      <main className="page-main" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head"><div><h2>Scan or enter a pass</h2><p>Point the camera at the QR code on the gate pass, or type the pass number</p></div></div>
          <div className="panel-body" style={{ display: 'grid', gap: 16 }}>
            {scanning ? (
              <>
                <QrScanner onScan={onScan} />
                <button className="btn btn-secondary" onClick={() => setScanning(false)}>Stop camera</button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => { setMessage(''); setOk(''); setScanning(true) }}>Scan QR with camera</button>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input mono" value={passInput} onChange={(e) => setPassInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void lookup(passInput) }} placeholder="e.g. QR-2026-0001" aria-label="Pass number" />
              <button className="btn btn-primary" disabled={busy || !passInput.trim()} onClick={() => void lookup(passInput)}>Look up</button>
            </div>
            {message && <Alert>{message}</Alert>}
            {ok && <Alert kind="success">{ok}</Alert>}
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Approved and waiting at the gate today</div>
              {expected.loading && !expected.data ? <Spinner /> : waiting.length === 0 ? <div className="person-sub">No approved visitors are waiting right now.</div> : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {waiting.map((v) => (
                    <button key={v.id} className="btn btn-secondary btn-sm mono" onClick={() => void lookup(v.passId)}>
                      {v.passId}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Visitor details</h2></div>
          <div className="panel-body">
            {!found ? <p className="muted" style={{ margin: 0 }}>Scan or look up a pass to see the visitor's details here.</p> : (
              <div style={{ display: 'grid', gap: 18 }}>
                <div className="person">
                  <PhotoThumb src={photoUrl(found.id)} fallback={found.photoInitials} size={72} alt={`Photo of ${found.name}`} />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{found.name}</div>
                    <div className="muted">{found.company || '—'}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
                  <div><div className="eyebrow">Pass</div><span className="mono">{found.passId}</span></div>
                  <div><div className="eyebrow">Host</div>{found.host || '—'}</div>
                  <div><div className="eyebrow">Purpose</div>{found.purpose}</div>
                  <div><div className="eyebrow">Scheduled</div>{found.visitDate} {found.visitTime}</div>
                  <div><div className="eyebrow">Check-in</div>{found.checkInTime ?? '—'}</div>
                  <div><div className="eyebrow">Check-out</div>{found.checkOutTime ?? '—'}</div>
                </div>
                {foundAlert && (
                  <div className="overstay-card">
                    <strong>{foundAlert.level === '24H' ? '24-hour alert' : '6-hour alert'}</strong>
                    <span>{foundAlert.message}</span>
                  </div>
                )}
                <div><StatusBadge status={found.status} /></div>
                {found.status === 'Pending Approval' || found.status === 'Rejected' ? (
                  <Alert>This pass isn't cleared for entry.</Alert>
                ) : found.status === 'Checked Out' ? (
                  <Alert kind="info">This pass has already been used.</Alert>
                ) : (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-success" disabled={busy || found.status !== 'Approved'} onClick={() => void act('in')}>Check In</button>
                    <button className="btn btn-secondary" disabled={busy || found.status !== 'Checked In'} onClick={() => void act('out')}>Check Out</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="panel span-2" style={{ minWidth: 0 }}>
          <div className="panel-head">
            <div><h2>Today's check-in and check-out history</h2><p>Visitors and vehicles that came through the gate today, with times</p></div>
            <span className="eyebrow">{rows.length} {rows.length === 1 ? 'record' : 'records'} · {vehiclesInside.length} vehicles inside</span>
          </div>
          {log.loading && !log.data ? <Spinner /> : rows.length === 0 ? (
            <Empty title="No check-ins yet today">Visitor check-ins and vehicle entries appear here as they happen.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Type</th><th>Name / Vehicle</th><th>Pass / Entry ID</th><th>Company / Driver</th><th>Host / Gate</th><th>In</th><th>Out</th><th>Time inside</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.kind}-${r.code}`} style={r.overdue ? { background: 'var(--red-bg)' } : undefined}>
                      <td><span className="badge">{r.kind === 'VISITOR' ? 'Visitor' : 'Vehicle'}</span></td>
                      <td className="person-name">{r.name}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{r.code}</td>
                      <td>{r.detail || '—'}</td>
                      <td>{r.place || '—'}</td>
                      <td className="mono">{r.inTime}</td>
                      <td className="mono">{r.outTime ?? '—'}</td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {Math.floor(r.minutesInside / 60)}h {String(r.minutesInside % 60).padStart(2, '0')}m
                        {r.overdue && <span className="badge badge-red" style={{ marginLeft: 6 }}>Over 6h</span>}
                      </td>
                      <td>{r.status}</td>
                      <td style={{ textAlign: 'right' }}>
                        {r.kind === 'VEHICLE' && r.status === 'Inside' && (
                          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void exitVehicle(r.code)}>Log exit</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel span-2" style={{ minWidth: 0 }}>
          <div className="panel-head">
            <div><h2>Not checked out</h2><p>Alert at 6 hours, escalated at 24 hours. Check out the visitor or log the vehicle exit.</p></div>
            <span className="eyebrow">{(alerts.data ?? []).length} active</span>
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
            {(alerts.data ?? []).length === 0 ? <Empty title="Nobody is overdue">Every visitor and vehicle is within 6 hours.</Empty> : (alerts.data ?? []).map((a) => (
              <div key={a.key} className="overstay-card">
                <div><strong>{a.kind === 'VISITOR' ? a.name : a.passOrVehicle}</strong> · {a.kind === 'VISITOR' ? a.passOrVehicle : a.code} · since {a.sinceTime}</div>
                <div style={{ fontSize: 13 }}>{a.message}</div>
                <div>
                  {a.kind === 'VISITOR' ? (
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void (async () => {
                      setBusy(true)
                      try { await api.checkOut(a.passOrVehicle); setOk(`${a.name} checked out.`); refreshAll() }
                      catch (e) { setMessage(e instanceof Error ? e.message : 'Check-out failed') }
                      finally { setBusy(false) }
                    })()}>Check out visitor</button>
                  ) : (
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void exitVehicle(a.code)}>Log vehicle exit</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}
