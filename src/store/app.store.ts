import { create } from 'zustand'
import type { Screen, Settings } from '../types'

interface AppStore {
  screen: Screen
  theme: 'light' | 'dark'
  settings: Settings | null
  settingsLoaded: boolean

  setScreen: (screen: Screen) => void
  setTheme: (theme: 'light' | 'dark') => void
  loadSettings: () => Promise<void>
  saveSetting: (key: keyof Settings, value: string) => Promise<void>
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  timer_work_minutes: '25',
  timer_short_break_minutes: '5',
  timer_long_break_minutes: '15',
  sound_enabled: 'true',
  sound_volume: '80',
  sound_type: 'chime',
  start_on_login: 'false'
}

export const useAppStore = create<AppStore>((set, get) => ({
  screen: 'board',
  theme: 'dark',
  settings: null,
  settingsLoaded: false,

  setScreen: (screen) => set({ screen }),

  setTheme: (theme) => {
    set({ theme })
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
    }
  },

  loadSettings: async () => {
    const settings = await window.api.getSettings()
    const merged = { ...DEFAULT_SETTINGS, ...settings }
    set({ settings: merged, settingsLoaded: true })
    // Apply theme immediately
    get().setTheme(merged.theme)
  },

  saveSetting: async (key, value) => {
    await window.api.setSetting(key, value)
    set((state) => ({
      settings: state.settings ? { ...state.settings, [key]: value } : state.settings
    }))
    if (key === 'theme') {
      get().setTheme(value as 'light' | 'dark')
    }
    if (key === 'start_on_login') {
      await window.api.setLoginItem(value === 'true')
    }
  }
}))
