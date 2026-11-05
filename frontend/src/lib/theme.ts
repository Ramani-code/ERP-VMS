export type Theme = 'light' | 'dark'

const KEY = 'vms.theme'

/** Saved choice first; otherwise follow the operating system's light/dark setting. */
export function currentTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage blocked: fall back to the system setting */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function setTheme(theme: Theme) {
  try { localStorage.setItem(KEY, theme) } catch { /* storage blocked: the choice lasts this visit only */ }
  applyTheme(theme)
}
