import type { VisitorStatus } from '../types'

const styles: Record<VisitorStatus, string> = {
  'Pending Approval': 'badge-amber',
  Approved: 'badge-blue',
  Rejected: 'badge-red',
  'Checked In': 'badge-green',
  'Checked Out': 'badge-slate'
}

export default function StatusBadge({ status }: { status: VisitorStatus }) {
  return <span className={`badge ${styles[status] ?? 'badge-slate'}`}>{status}</span>
}
