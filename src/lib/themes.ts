export type ThemeId =
  | 'midnight' | 'clean'
  | 'nord' | 'rose-pine' | 'tokyo-night' | 'everforest'
  | 'paper' | 'nord-light'

export interface ThemeDef {
  id: ThemeId
  name: string
  isDark: boolean
  preview: {
    bg: string
    surface: string
    accent: string
    text: string
  }
}

export const THEMES: ThemeDef[] = [
  // Dark
  { id: 'midnight',    name: 'Midnight',    isDark: true,  preview: { bg: '#0e0e0c', surface: '#171715', accent: '#818cf8', text: '#fafafa' } },
  { id: 'nord',        name: 'Nord',        isDark: true,  preview: { bg: '#2e3440', surface: '#3b4252', accent: '#88c0d0', text: '#eceff4' } },
  { id: 'rose-pine',   name: 'Ros\u00e9 Pine',   isDark: true,  preview: { bg: '#232136', surface: '#2a273f', accent: '#c4a7e7', text: '#e0def4' } },
  { id: 'tokyo-night', name: 'Tokyo Night', isDark: true,  preview: { bg: '#1a1b26', surface: '#1f2335', accent: '#7aa2f7', text: '#c0caf5' } },
  { id: 'everforest',  name: 'Everforest',  isDark: true,  preview: { bg: '#2d353b', surface: '#343f44', accent: '#a7c080', text: '#d3c6aa' } },
  // Light
  { id: 'clean',       name: 'Clean',       isDark: false, preview: { bg: '#fafafa', surface: '#ffffff', accent: '#4f46e5', text: '#171715' } },
  { id: 'paper',       name: 'Paper',       isDark: false, preview: { bg: '#f4efe6', surface: '#faf7f2', accent: '#b07843', text: '#3d3529' } },
  { id: 'nord-light',  name: 'Nord Light',  isDark: false, preview: { bg: '#eceff4', surface: '#f2f4f8', accent: '#5e81ac', text: '#2e3440' } },
]

export const DARK_THEMES = THEMES.filter(t => t.isDark)
export const LIGHT_THEMES = THEMES.filter(t => !t.isDark)

export function getTheme(id: string): ThemeDef {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}

export function resolveThemeId(value: string): ThemeId {
  if (value === 'dark') return 'midnight'
  if (value === 'light') return 'clean'
  const found = THEMES.find(t => t.id === value)
  return found ? found.id : 'midnight'
}

/** Get opposite-mode theme: if current is dark → first light theme, vice versa */
export function getOppositeThemeId(currentId: string): ThemeId {
  const current = getTheme(currentId)
  if (current.isDark) return LIGHT_THEMES[0].id
  return DARK_THEMES[0].id
}
