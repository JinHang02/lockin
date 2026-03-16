import { create } from 'zustand'
import type { Screen, Settings } from '../types'
import { THEMES, resolveThemeId, getTheme } from '@/lib/themes'

interface AppStore {
  screen: Screen
  theme: string
  settings: Settings | null
  settingsLoaded: boolean

  setScreen: (screen: Screen) => void
  setTheme: (themeId: string) => void
  loadSettings: () => Promise<void>
  saveSetting: (key: keyof Settings, value: string) => Promise<void>
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'midnight',
  timer_work_minutes: '25',
  timer_short_break_minutes: '5',
  timer_long_break_minutes: '15',
  sound_enabled: 'true',
  sound_volume: '80',
  sound_type: 'chime',
  start_on_login: 'false',
  streak_range: '7',
  reminders_enabled: 'true',
  reminder_nudge_enabled: 'true',
  reminder_nudge_hour: '10',
  reminder_due_enabled: 'true',
  reminder_due_hour: '9',
  streak_grace_days: '0',
  focus_mode: 'dim'
}

export const useAppStore = create<AppStore>((set, get) => ({
  screen: 'board',
  theme: 'midnight',
  settings: null,
  settingsLoaded: false,

  setScreen: (screen) => set({ screen }),

  setTheme: (themeId) => {
    const id = resolveThemeId(themeId)
    const themeDef = getTheme(id)
    set({ theme: id })

    const el = document.documentElement
    // Remove old classes
    el.classList.remove('dark', 'light')
    THEMES.forEach(t => el.classList.remove(`theme-${t.id}`))
    // Apply new classes
    el.classList.add(themeDef.isDark ? 'dark' : 'light')
    el.classList.add(`theme-${id}`)
  },

  loadSettings: async () => {
    const settings = await window.api.getSettings()
    const merged = { ...DEFAULT_SETTINGS, ...settings }
    // Normalize legacy 'dark'/'light' values
    merged.theme = resolveThemeId(merged.theme)
    set({ settings: merged, settingsLoaded: true })
    get().setTheme(merged.theme)
  },

  saveSetting: async (key, value) => {
    await window.api.setSetting(key, value)
    set((state) => ({
      settings: state.settings ? { ...state.settings, [key]: value } : state.settings
    }))
    if (key === 'theme') {
      get().setTheme(value)
    }
    if (key === 'start_on_login') {
      await window.api.setLoginItem(value === 'true')
    }
  }
}))
