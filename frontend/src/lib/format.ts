/** 30 -> "30 min", 120 -> "2 hr", 150 -> "2 hr 30 min" */
export const stayLabel = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export const STAY_OPTIONS = [30, 60, 90, 120, 180, 240, 360, 480]

export const formatWeight = (kg: number | null | undefined) =>
  kg === null || kg === undefined ? '—' : kg.toLocaleString('en-IN', { maximumFractionDigits: 2 })
