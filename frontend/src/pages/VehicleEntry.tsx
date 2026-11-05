import { useState, type FormEvent } from 'react'
import PageHeading from '../components/PageHeading'
import CameraCapture from '../components/CameraCapture'
import PhotoThumb from '../components/PhotoThumb'
import SpeechToText from '../components/SpeechToText'
import { Alert, Empty, Field, Spinner } from '../components/Feedback'
import { ACCESS, useAuth } from '../lib/auth'
import { api, photoUrl } from '../lib/api'
import { optionFrom, plateFrom, weightFrom } from '../lib/speech'
import { useLoad } from '../lib/useLoad'
import type { VehiclePayload } from '../types'

const blank: VehiclePayload = {
  vehicleNumber: '', driverName: '', vendor: '', material: '', purpose: '', gate: '', loadWeight: '', photo: ''
}

/** Words that introduce each field when speaking, in English, Tamil and Hindi. */
const SPEECH_LABELS: Record<string, string[]> = {
  vehicleNumber: ['vehicle number', 'vehicle no', 'number plate', 'vehicle', 'வாகன எண்', 'வாகனம்', 'गाड़ी नंबर', 'वाहन नंबर', 'वाहन'],
  driverName: ['driver name', 'driver', 'ஓட்டுநர்', 'ड्राइवर'],
  loadWeight: ['load weight', 'weight', 'load', 'எடை', 'वजन'],
  vendor: ['vendor', 'supplier', 'விற்பனையாளர்', 'विक्रेता'],
  material: ['material', 'goods', 'பொருள்', 'सामग्री', 'माल'],
  purpose: ['purpose', 'reason', 'நோக்கம்', 'उद्देश्य'],
  gate: ['gate', 'கேட்', 'வாயில்', 'गेट']
}

const SPEECH_NAMES: Record<string, string> = {
  vehicleNumber: 'vehicle number', driverName: 'driver', loadWeight: 'load weight', vendor: 'vendor', material: 'material', purpose: 'purpose', gate: 'gate'
}

export default function VehicleEntryPage() {
  const { can } = useAuth()
  const canWrite = can(...ACCESS.vehicleWrite)
  const gates = useLoad(() => api.gates())
  const log = useLoad(() => api.vehicles(), [], 15000)
  const [form, setForm] = useState<VehiclePayload>(blank)
  const [error, setError] = useState('')
  const [speechReset, setSpeechReset] = useState(0)
  const [busy, setBusy] = useState('')

  const gateOptions = gates.data ?? []
  const gate = form.gate || gateOptions[0] || ''
  const set = (k: keyof VehiclePayload) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  /** Turns what was said for one field into the value to store. */
  const normalizeSpoken = (key: string, spoken: string): string => {
    switch (key) {
      case 'vehicleNumber': return plateFrom(spoken)
      case 'loadWeight': return weightFrom(spoken)
      case 'gate': return optionFrom(spoken, gateOptions)
      default: return spoken.trim()
    }
  }

  const applyFields = (patch: Record<string, string>) =>
    setForm((f) => ({ ...f, ...(patch as Partial<VehiclePayload>) }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!gate) { setError('Add an active gate before logging vehicles.'); return }
    setBusy('new'); setError('')
    try {
      await api.addVehicle({ ...form, gate })
      setForm(blank); setSpeechReset((n) => n + 1)
      await log.reload(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not log the vehicle') }
    finally { setBusy('') }
  }

  const exit = async (id: string) => {
    setBusy(id); setError('')
    try { await api.vehicleExit(id); await log.reload(true) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not log the exit') }
    finally { setBusy('') }
  }

  const entries = log.data ?? []

  return (
    <>
      <PageHeading title="Vehicle Entry Monitoring" subtitle="Log inbound vehicles with load weight and a photo, then close out gate passes on exit" />
      <main className="page-main" style={{ gridTemplateColumns: canWrite ? 'minmax(300px, 1fr) minmax(0, 2fr)' : '1fr', alignItems: 'start' }}>
        {canWrite && (
          <form onSubmit={submit} className="panel">
            <div className="panel-head"><div><h2>New vehicle log</h2><p>Speak the details with the microphone and the fields fill in, or type them.</p></div></div>
            <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
              {error && <Alert>{error}</Alert>}
              <SpeechToText labels={SPEECH_LABELS} names={SPEECH_NAMES} normalize={normalizeSpoken} onFields={applyFields}
                resetKey={speechReset}
                example="“vehicle number KA 05 MN 4471, driver Suresh, load weight 2500, material steel, gate 1”." />

              <Field label="Vehicle number" required>
                <input className="input" required maxLength={30} placeholder="e.g. KA 05 MN 4471" value={form.vehicleNumber} onChange={(e) => set('vehicleNumber')(e.target.value)} />
              </Field>
              <Field label="Driver name" required>
                <input className="input" required maxLength={120} value={form.driverName} onChange={(e) => set('driverName')(e.target.value)} />
              </Field>
              <Field label="Load weight (kg)">
                <input className="input" type="number" inputMode="decimal" min="0" step="0.01" max="100000"
                  placeholder="e.g. 2500" value={form.loadWeight} onChange={(e) => set('loadWeight')(e.target.value)} />
              </Field>
              <Field label="Vendor">
                <input className="input" maxLength={150} value={form.vendor} onChange={(e) => set('vendor')(e.target.value)} />
              </Field>
              <Field label="Material">
                <input className="input" maxLength={150} value={form.material} onChange={(e) => set('material')(e.target.value)} />
              </Field>
              <Field label="Purpose">
                <input className="input" maxLength={150} value={form.purpose} onChange={(e) => set('purpose')(e.target.value)} />
              </Field>
              <Field label="Gate" required>
                <select className="input" required value={gate} onChange={(e) => set('gate')(e.target.value)} disabled={gateOptions.length === 0}>
                  {gateOptions.length === 0 && <option value="">No gates available. Ask an admin to add one.</option>}
                  {gateOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <CameraCapture label="Vehicle photo" facing="environment" value={form.photo} onChange={set('photo')} />
              <button className="btn btn-primary btn-block" disabled={busy === 'new' || !gate}>{busy === 'new' ? 'Saving…' : 'Log vehicle entry'}</button>
            </div>
          </form>
        )}

        <section className="panel" style={{ minWidth: 0 }}>
          <div className="panel-head"><div><h2>Gate log</h2><p>Today's vehicle movements with load weight, photos and times</p></div><span className="eyebrow">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span></div>
          {!canWrite && error && <div className="panel-body"><Alert>{error}</Alert></div>}
          {log.loading && !log.data ? <Spinner /> : log.error ? <div className="panel-body"><Alert>{log.error}</Alert></div> : entries.length === 0 ? (
            <Empty title="No vehicles logged today">Entries you record appear here.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Photo</th><th>Vehicle</th><th>Vendor</th><th>Material</th><th>Load</th><th>Purpose</th><th>Gate</th><th>In → Out</th><th /></tr></thead>
                <tbody>
                  {entries.map((v) => (
                    <tr key={v.id}>
                      <td><PhotoThumb src={photoUrl(v.id)} fallback="VH" size={56} alt={`Photo of vehicle ${v.vehicleNumber}`} /></td>
                      <td><div className="mono" style={{ fontWeight: 600 }}>{v.vehicleNumber}</div><div className="person-sub">{v.driverName}</div></td>
                      <td>{v.vendor || '—'}</td><td>{v.material || '—'}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{v.loadWeight != null ? `${v.loadWeight} kg` : '—'}</td>
                      <td>{v.purpose || '—'}</td><td>{v.gate}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{v.entryTime} → {v.exitTime ?? <span className="badge badge-green">inside</span>}</td>
                      <td style={{ textAlign: 'right' }}>
                        {!v.exitTime && canWrite && <button className="btn btn-secondary btn-sm" disabled={busy === v.id} onClick={() => void exit(v.id)}>Log exit</button>}
                      </td>
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
