import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import PageHeading from '../components/PageHeading'
import GatePass from '../components/GatePass'
import CameraCapture from '../components/CameraCapture'
import SpeechToText from '../components/SpeechToText'
import { Alert, Field } from '../components/Feedback'
import { ACCESS, useAuth } from '../lib/auth'
import { api, todayIso } from '../lib/api'
import { emailFrom, optionFrom, phoneFrom } from '../lib/speech'
import { useLoad } from '../lib/useLoad'
import type { RegistrationPayload, Visitor, VisitorProfile } from '../types'

const emptyForm: RegistrationPayload = {
  name: '', mobile: '', email: '', company: '', purpose: '', host: '', department: '', gate: '',
  visitDate: '', visitTime: '', photo: ''
}

/** Words that introduce each field when speaking, in English, Tamil and Hindi. */
const SPEECH_LABELS: Record<string, string[]> = {
  name: ['visitor name', 'name', 'பெயர்', 'नाम'],
  mobile: ['mobile number', 'mobile no', 'mobile', 'phone number', 'phone', 'contact number', 'contact', 'மொபைல்', 'தொலைபேசி', 'मोबाइल', 'फोन'],
  email: ['email id', 'email', 'mail', 'மின்னஞ்சல்', 'ईमेल'],
  company: ['company name', 'company', 'firm', 'நிறுவனம்', 'कंपनी'],
  purpose: ['purpose of visit', 'purpose', 'reason', 'நோக்கம்', 'उद्देश्य'],
  host: ['host name', 'host', 'to meet', 'ஹோஸ்ட்', 'சந்திக்க', 'होस्ट', 'मिलना'],
  department: ['department', 'dept', 'துறை', 'विभाग'],
  gate: ['entry gate', 'gate', 'கேட்', 'வாயில்', 'गेट']
}

const SPEECH_NAMES: Record<string, string> = {
  name: 'name', mobile: 'mobile', email: 'email', company: 'company', purpose: 'purpose', host: 'host', department: 'department', gate: 'gate'
}

export default function VisitorRegistration() {
  const { can } = useAuth()
  const departments = useLoad(() => api.departments())
  const gates = useLoad(() => api.gates())
  const [visitorType, setVisitorType] = useState<'new' | 'existing'>('new')
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<VisitorProfile[]>([])
  const [form, setForm] = useState<RegistrationPayload>({ ...emptyForm, visitDate: todayIso() })
  const [pass, setPass] = useState<Visitor | null>(null)
  const [error, setError] = useState('')
  const [speechReset, setSpeechReset] = useState(0)
  const [busy, setBusy] = useState(false)

  const gateOptions = gates.data ?? []
  const departmentOptions = departments.data ?? []
  const gate = form.gate || gateOptions[0] || ''

  useEffect(() => {
    if (visitorType !== 'existing' || search.trim().length < 2) { setMatches([]); return }
    const t = window.setTimeout(() => {
      api.searchProfiles(search.trim()).then(setMatches).catch(() => setMatches([]))
    }, 250)
    return () => window.clearTimeout(t)
  }, [search, visitorType])

  const update = (key: keyof RegistrationPayload) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  /** Turns what was said for one field into the value to store. */
  const normalizeSpoken = (key: string, spoken: string): string => {
    switch (key) {
      case 'mobile': return phoneFrom(spoken)
      case 'email': return emailFrom(spoken)
      case 'department': return optionFrom(spoken, departmentOptions)
      case 'gate': return optionFrom(spoken, gateOptions)
      default: return spoken.trim()
    }
  }

  const applyFields = (patch: Record<string, string>) =>
    setForm((f) => ({ ...f, ...(patch as Partial<RegistrationPayload>) }))

  const applyExisting = (p: VisitorProfile) => {
    setForm((f) => ({
      ...f, name: p.name, mobile: p.phone, email: p.email ?? '', company: p.company ?? '',
      host: p.lastHost ?? '', department: p.lastDepartment ?? ''
    }))
    setSearch(p.name)
    setMatches([])
  }

  const reset = () => {
    setForm({ ...emptyForm, visitDate: todayIso() })
    setPass(null); setSearch(''); setError(''); setSpeechReset((n) => n + 1)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!gate) { setError('Add an active gate before registering visitors.'); return }
    setBusy(true); setError('')
    try {
      setPass(await api.register({ ...form, gate }))
      setForm({ ...emptyForm, visitDate: todayIso() })
      setSearch(''); setSpeechReset((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register the visitor')
    } finally {
      setBusy(false)
    }
  }

  if (!can(...ACCESS.registration)) {
    return <><PageHeading title="Visitor Registration" /><main className="page-main"><Alert>Your role does not have access to visitor registration.</Alert></main></>
  }

  return (
    <>
      <PageHeading title="Visitor Registration" subtitle="Capture visitor details and route the pass for host approval" />
      <main className="page-main" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', alignItems: 'start' }}>
        <form onSubmit={onSubmit} className="panel span-2" style={{ minWidth: 0 }}>
          <div className="panel-head"><div><h2>Visitor details</h2><p>Fields marked * are required. Speak the details with the microphone and the fields fill in, or type them.</p></div></div>
          <div className="panel-body" style={{ display: 'grid', gap: 18 }}>
            {error && <Alert>{error}</Alert>}

            <SpeechToText labels={SPEECH_LABELS} names={SPEECH_NAMES} normalize={normalizeSpoken} onFields={applyFields}
              resetKey={speechReset}
              example="“name Ravi Kumar, mobile 9845011223, purpose meeting, host Karan, department IT, gate 1”." />

            <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="eyebrow">Visitor type</span>
              {(['new', 'existing'] as const).map((t) => (
                <label key={t} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" name="visitorType" checked={visitorType === t} onChange={() => setVisitorType(t)} />
                  {t === 'new' ? 'New visitor' : 'Existing visitor'}
                </label>
              ))}
            </div>

            {visitorType === 'existing' && (
              <div style={{ position: 'relative' }}>
                <span className="eyebrow field-label">Search by name or mobile</span>
                <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Start typing (min. 2 characters)…" />
                {matches.length > 0 && (
                  <div className="suggest">
                    {matches.map((m) => (
                      <button type="button" key={m.id} onClick={() => applyExisting(m)}>
                        <span><strong>{m.name}</strong> · {m.phone}</span><span className="muted">{m.company || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                {search.trim().length >= 2 && matches.length === 0 && <div className="person-sub" style={{ marginTop: 6 }}>No saved visitors match. Fill the form to add a new one.</div>}
              </div>
            )}

            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <Field label="Visitor name" required>
                <input className="input" required maxLength={120} value={form.name} onChange={update('name')} />
              </Field>
              <Field label="Mobile number" required>
                <input className="input" required maxLength={30} inputMode="tel" value={form.mobile} onChange={update('mobile')} />
              </Field>
              <Field label="Email">
                <input className="input" type="email" maxLength={150} value={form.email} onChange={update('email')} />
              </Field>
              <Field label="Company">
                <input className="input" maxLength={150} value={form.company} onChange={update('company')} />
              </Field>
              <Field label="Purpose of visit" required>
                <input className="input" required maxLength={200} value={form.purpose} onChange={update('purpose')} />
              </Field>
              <Field label="Host name">
                <input className="input" maxLength={120} value={form.host} onChange={update('host')} />
              </Field>
              <Field label="Department">
                <select className="input" value={form.department} onChange={update('department')}>
                  <option value="">Select department</option>
                  {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Entry gate" required>
                <select className="input" required value={gate} onChange={update('gate')} disabled={gateOptions.length === 0}>
                  {gateOptions.length === 0 && <option value="">No gates available. Ask an admin to add one.</option>}
                  {gateOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Visit date" required>
                <input className="input" required type="date" min={todayIso()} value={form.visitDate} onChange={update('visitDate')} />
              </Field>
              <Field label="Visit time" required>
                <input className="input" required type="time" value={form.visitTime} onChange={update('visitTime')} />
              </Field>
            </div>

            <CameraCapture label="Visitor photo" facing="user" value={form.photo}
              onChange={(photo) => setForm((f) => ({ ...f, photo }))} />

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" disabled={busy || !gate}>{busy ? 'Generating…' : 'Generate Pass'}</button>
              <button type="button" className="btn btn-secondary" onClick={reset}>Clear form</button>
            </div>
          </div>
        </form>

        <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <div className="eyebrow">Pass preview</div>
          {pass ? (
            <>
              <Alert kind="success">Pass {pass.passId} created for {pass.gate ?? 'the selected gate'} and sent for host approval.</Alert>
              <GatePass visitor={pass} />
              <button className="btn btn-secondary no-print" style={{ justifySelf: 'start' }} onClick={() => window.print()}>Print pass</button>
            </>
          ) : (
            <div className="panel panel-body muted">Fill in the visitor's details and generate a pass. It is saved to the database and appears here.</div>
          )}
        </div>
      </main>
    </>
  )
}
