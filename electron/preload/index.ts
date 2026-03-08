import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../main/channels'

// Type-safe bridge between renderer and main process
const api = {
  // Categories
  getCategories: ()                                   => ipcRenderer.invoke(IPC.CATEGORIES_GET_ALL),
  createCategory: (args: { label: string; color: string }) => ipcRenderer.invoke(IPC.CATEGORIES_CREATE, args),
  updateCategory: (args: { id: string; label?: string; color?: string }) => ipcRenderer.invoke(IPC.CATEGORIES_UPDATE, args),
  deleteCategory: (id: string)                        => ipcRenderer.invoke(IPC.CATEGORIES_DELETE, { id }),

  // Tasks
  getTodayTasks:     ()                               => ipcRenderer.invoke(IPC.TASKS_GET_TODAY),
  getCarryoverTasks: ()                               => ipcRenderer.invoke(IPC.TASKS_GET_CARRYOVER),
  createTask:        (args: object)                   => ipcRenderer.invoke(IPC.TASKS_CREATE, args),
  updateTask:        (args: object)                   => ipcRenderer.invoke(IPC.TASKS_UPDATE, args),
  deleteTask:        (id: string)                     => ipcRenderer.invoke(IPC.TASKS_DELETE, { id }),
  reorderTasks:      (ids: string[])                  => ipcRenderer.invoke(IPC.TASKS_REORDER, { ids }),
  resolveCarry:      (id: string, action: 'keep' | 'drop') => ipcRenderer.invoke(IPC.TASKS_RESOLVE_CARRY, { id, action }),

  // Search
  searchTasks:       (query: string)                  => ipcRenderer.invoke(IPC.TASKS_SEARCH, { query }),

  // Bulk operations
  bulkUpdateTasks:   (ids: string[], status: string)  => ipcRenderer.invoke(IPC.TASKS_BULK_UPDATE, { ids, status }),
  bulkDeleteTasks:   (ids: string[])                  => ipcRenderer.invoke(IPC.TASKS_BULK_DELETE, { ids }),

  // Pomodoro sessions
  createSession:      (args: object)                  => ipcRenderer.invoke(IPC.SESSIONS_CREATE, args),
  getSessionsByDate:  (date: string)                  => ipcRenderer.invoke(IPC.SESSIONS_GET_BY_DATE, { date }),
  getSessionCountsByTask: ()                          => ipcRenderer.invoke(IPC.SESSIONS_COUNT_BY_TASK),
  getTodayStats:      ()                              => ipcRenderer.invoke(IPC.SESSIONS_TODAY_STATS),
  getStreak:          ()                              => ipcRenderer.invoke(IPC.SESSIONS_STREAK),
  getStreakDetail:     ()                              => ipcRenderer.invoke(IPC.SESSIONS_STREAK_DETAIL),

  // Calendar
  getCalendarByDate:  (date: string)                  => ipcRenderer.invoke(IPC.CALENDAR_GET_BY_DATE, { date }),

  // Journal
  getJournalByDate:  (date: string)                   => ipcRenderer.invoke(IPC.JOURNAL_GET_BY_DATE, { date }),
  upsertJournal:     (args: object)                   => ipcRenderer.invoke(IPC.JOURNAL_UPSERT, args),

  // Notes
  getNotes:      ()                               => ipcRenderer.invoke(IPC.NOTES_GET_ALL),
  getNote:       (id: string)                     => ipcRenderer.invoke(IPC.NOTES_GET_ONE, { id }),
  createNote:    (args: object)                   => ipcRenderer.invoke(IPC.NOTES_CREATE, args),
  updateNote:    (args: object)                   => ipcRenderer.invoke(IPC.NOTES_UPDATE, args),
  deleteNote:    (id: string)                     => ipcRenderer.invoke(IPC.NOTES_DELETE, { id }),

  // Recurring tasks
  getRecurringTasks:     ()                           => ipcRenderer.invoke(IPC.RECURRING_GET_ALL),
  createRecurringTask:   (args: object)               => ipcRenderer.invoke(IPC.RECURRING_CREATE, args),
  updateRecurringTask:   (args: object)               => ipcRenderer.invoke(IPC.RECURRING_UPDATE, args),
  deleteRecurringTask:   (id: string)                 => ipcRenderer.invoke(IPC.RECURRING_DELETE, { id }),
  generateRecurringTasks:()                           => ipcRenderer.invoke(IPC.RECURRING_GENERATE),

  // Analytics
  getWeeklyStats:       (days: number)                => ipcRenderer.invoke(IPC.ANALYTICS_WEEKLY, { days }),
  getCategoryBreakdown: (days: number)                => ipcRenderer.invoke(IPC.ANALYTICS_CATEGORY_BREAKDOWN, { days }),
  getDailyHistory:      (days: number)                => ipcRenderer.invoke(IPC.ANALYTICS_DAILY_HISTORY, { days }),

  // Backup
  exportData:     ()                                  => ipcRenderer.invoke(IPC.DATA_EXPORT),
  importData:     (data: string)                      => ipcRenderer.invoke(IPC.DATA_IMPORT, { data }),

  // Settings
  getSettings:       ()                               => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSetting:        (key: string, value: string)     => ipcRenderer.invoke(IPC.SETTINGS_SET, { key, value }),

  // System
  setLoginItem:      (enabled: boolean)               => ipcRenderer.invoke(IPC.SET_LOGIN_ITEM, { enabled }),
  setWindowTitle:    (title: string)                  => ipcRenderer.invoke(IPC.SET_WINDOW_TITLE, { title }),
  setTrayTooltip:    (tooltip: string)                => ipcRenderer.invoke(IPC.SET_TRAY_TOOLTIP, { tooltip }),
} as const

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
