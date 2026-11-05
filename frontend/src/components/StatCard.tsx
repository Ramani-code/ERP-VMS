import type { ReactNode } from 'react'

export default function StatCard({ label, value, hint, icon, accent }: {
  label: string; value: number | string; hint: string; icon: ReactNode; accent: string
}) {
  return (
    <div className="panel stat-card" style={{ ['--accent' as string]: accent }}>
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        <div className="stat-hint">{hint}</div>
      </div>
    </div>
  )
}
