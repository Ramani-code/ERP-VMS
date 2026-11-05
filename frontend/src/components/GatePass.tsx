import PhotoThumb from './PhotoThumb'
import QrCode from './QrCode'
import { photoUrl } from '../lib/api'
import type { Visitor } from '../types'

/** Visitor pass with a real, scannable QR code that encodes the pass number. */
export default function GatePass({ visitor }: { visitor: Visitor }) {
  return (
    <div id="printable-pass" className="gate-pass">
      <div className="gate-pass-stub">
        <span className="vertical">VISITOR PASS</span>
        <span className="initials">{visitor.photoInitials}</span>
      </div>
      <div className="gate-pass-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
            <PhotoThumb src={photoUrl(visitor.id)} fallback={visitor.photoInitials} size={64} alt={`Photo of ${visitor.name}`} />
            <div style={{ minWidth: 0 }}>
              <div className="eyebrow">Smart VMS · Gate Pass</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>{visitor.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{visitor.company || '—'}</div>
            </div>
          </div>
          <QrCode value={visitor.passId} size={104} label={`Pass QR code ${visitor.passId}`} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, fontSize: 13 }}>
          <div><div className="eyebrow">Host</div>{visitor.host || '—'}</div>
          <div><div className="eyebrow">Department</div>{visitor.department || '—'}</div>
          <div><div className="eyebrow">Visit date</div>{visitor.visitDate}</div>
          <div><div className="eyebrow">Visit time</div>{visitor.visitTime}</div>
          <div><div className="eyebrow">Entry gate</div>{visitor.gate || "—"}</div>
        </div>
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{visitor.passId}</span>
          <span className="eyebrow">Single entry</span>
        </div>
      </div>
    </div>
  )
}
