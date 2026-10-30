import { ref, watch } from 'vue'
import { loadPrefs, savePrefs } from './persistence'

type Theme = 'auto' | 'light' | 'dark'

const state = loadPrefs()
const isDark = ref(false)

function systemDark(): boolean {
  return typeof window !== 'undefined'
    && (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
}

function applyTheme(): void {
  isDark.value = state.theme === 'dark' || (state.theme === 'auto' && systemDark())
  if (typeof document !== 'undefined')
    document.documentElement.classList.toggle('dark', isDark.value)
}

function setTheme(theme: Theme): void {
  state.theme = theme
  savePrefs(state)
  applyTheme()
}

export function useTheme() {
  if (typeof window !== 'undefined') {
    applyTheme()
    window.matchMedia?.('(prefers-color-scheme: dark)')
      .addEventListener('change', () => state.theme === 'auto' && applyTheme())
    watch(() => state.theme, applyTheme)
  }
  return {
    theme: state,
    isDark,
    setTheme,
    toggle() {
      setTheme(isDark.value ? 'light' : 'dark')
    },
  }
}
