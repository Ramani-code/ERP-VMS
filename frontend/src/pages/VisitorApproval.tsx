import { useState } from 'react'
import PageHeading from '../components/PageHeading'
import StatusBadge from '../components/StatusBadge'
import { Alert, Empty, Spinner } from '../components/Feedback'
import { ACCESS, useAuth } from '../lib/auth'
import { api, todayIso } from '../lib/api'
import { useLoad } from '../lib/useLoad'

export default function VisitorApproval() {
  const { can } = useAuth()
  const { data, error, loading, reload } = useLoad(() => api.visitors(), [], 20000)
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [newDate, setNewDate] = useState(todayIso())
  const [newTime, setNewTime] = useState('')

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id); setActionError('')
    try { await fn(); setEditing(null); await reload(true) }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Action failed') }
    finally { setBusyId('') }
  }

  if (!can(...ACCESS.approvals)) {
    return <><PageHeading title="Visitor Approvals" /><main className="page-main"><Alert>Your role cannot approve visitors.</Alert></main></>
  }

  const all = data ?? []
  const pending = all.filter((v) => v.status === 'Pending Approval')
  const decided = all.filter((v) => v.status !== 'Pending Approval')

  return (
    <>
      <PageHeading title="Visitor Approvals" subtitle="Review requests routed to hosts" />
      <main className="page-main">
        {(error || actionError) && <Alert>{error || actionError}</Alert>}
        <section className="panel">
          <div className="panel-head"><h2>Awaiting decision</h2><span className="eyebrow">{pending.length} pending</span></div>
          {loading && !data ? <Spinner /> : pending.length === 0 ? <Empty title="No requests waiting">New registrations will show up here.</Empty> : (
            <div>
              {pending.map((v) => (
                <div key={v.id} className="list-row">
                  <div className="person">
                    <div className="chip-avatar">{v.photoInitials}</div>
                    <div>
                      <div className="person-name">{v.name} <span className="muted" style={{ fontWeight: 500 }}>· {v.company || '—'}</span></div>
                      <div className="person-sub">{v.purpose} · {v.visitDate} at {v.visitTime} · Host: {v.host || '—'}</div>
                      <div className="person-sub mono">{v.passId}</div>
                    </div>
                  </div>
                  {editing === v.id ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input className="input" style={{ width: 150 }} type="date" min={todayIso()} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                      <input className="input" style={{ width: 120 }} type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                      <button className="btn btn-primary btn-sm" disabled={!newDate || !newTime || busyId === v.id}
                        onClick={() => run(v.id, () => api.reschedule(v.id, newDate, newTime))}>Save</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-danger btn-sm" disabled={busyId === v.id} onClick={() => run(v.id, () => api.reject(v.id))}>Reject</button>
                      <button className="btn btn-secondary btn-sm" disabled={busyId === v.id}
                        onClick={() => { setEditing(v.id); setNewDate(v.visitDate); setNewTime(v.visitTime) }}>Reschedule</button>
                      <button className="btn btn-success btn-sm" disabled={busyId === v.id} onClick={() => run(v.id, () => api.approve(v.id))}>Approve</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Decision history</h2><span className="eyebrow">{decided.length} records</span></div>
          {decided.length === 0 ? <Empty title="No history yet" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Visitor</th><th>Purpose</th><th>Host</th><th>Visit</th><th>Status</th></tr></thead>
                <tbody>
                  {decided.map((v) => (
                    <tr key={v.id}>
                      <td><div className="person-name">{v.name}</div><div className="person-sub mono">{v.passId}</div></td>
                      <td>{v.purpose}</td><td>{v.host || '—'}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{v.visitDate} {v.visitTime}</td>
                      <td><StatusBadge status={v.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
