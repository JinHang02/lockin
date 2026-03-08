// ── Core entities ─────────────────────────────────────────────────────────────

export interface Category {
  id: string
  label: string
  color: string
  is_predefined: number // 0 | 1 (SQLite boolean)
}

export interface Task {
  id: string
  title: string
  status: 'todo' | 'in-progress' | 'done' | 'blocked'
  priority: number
  category_id: string | null
  category_label: string | null
  category_color: string | null
  notes: string | null
  created_at: string
  completed_at: string | null
  carry_over_date: string | null
}

export interface PomodoroSession {
  id: string
  task_id: string
  task_title?: string
  started_at: string
  ended_at: string
  duration_minutes: number
  outcome: 'done' | 'still-going' | 'blocked'
  block_note: string | null
}

export interface CalendarBlock {
  id: string
  session_id: string
  task_id: string
  task_title?: string
  start_time: string
  end_time: string
  date: string
  color_tag: string
  outcome?: 'done' | 'still-going' | 'blocked'
  duration_minutes?: number
}

export interface AutoSummary {
  session_count: number
  total_focus_minutes: number
  tasks_completed: string[]
  blocks: Array<{
    task_title: string
    start_time: string
    end_time: string
    color_tag: string
    outcome: string
  }>
}

export interface JournalEntry {
  id: string
  date: string
  intention: string | null
  narrative: string | null
  mood: number | null
  auto_summary: string // JSON string
}

export interface Note {
  id: string
  title: string
  content: string
  task_id: string | null
  is_pinned: number
  created_at: string
  updated_at: string
}

export interface Settings {
  theme: string
  timer_work_minutes: string
  timer_short_break_minutes: string
  timer_long_break_minutes: string
  sound_enabled: string
  sound_volume: string
  sound_type: string
  start_on_login: string
  streak_range: string
}

// ── Recurring tasks ──────────────────────────────────────────────────────────

export interface RecurringTask {
  id: string
  title: string
  category_id: string | null
  category_label?: string | null
  category_color?: string | null
  notes: string | null
  recurrence: 'daily' | 'weekdays' | 'weekly' | 'monthly'
  active: number
  last_generated_date: string | null
  created_at: string
}

export interface CreateRecurringTaskInput {
  title: string
  category_id?: string
  notes?: string
  recurrence: RecurringTask['recurrence']
}

export interface UpdateRecurringTaskInput {
  id: string
  title?: string
  category_id?: string | null
  notes?: string | null
  recurrence?: RecurringTask['recurrence']
  active?: number
}

// ── Analytics ────────────────────────────────────────────────────────────────

export interface WeeklyStats {
  date: string
  session_count: number
  total_minutes: number
  tasks_completed: number
}

export interface CategoryBreakdown {
  category_label: string
  category_color: string
  session_count: number
  total_minutes: number
}

// ── Streak ──────────────────────────────────────────────────────────────────

export interface StreakDetail {
  current: number
  best: number
  allActiveDates: string[]
}

// ── Search ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  type: 'task' | 'journal'
  id: string
  title: string
  subtitle?: string
  status?: string
  date?: string
  category_label?: string | null
  category_color?: string | null
}

export interface SearchResults {
  tasks: SearchResult[]
  journals: SearchResult[]
}

// ── Backup ───────────────────────────────────────────────────────────────────

export interface BackupData {
  version: number
  exported_at: string
  categories: Category[]
  tasks: Task[]
  pomodoro_sessions: PomodoroSession[]
  calendar_blocks: CalendarBlock[]
  journal_entries: JournalEntry[]
  notes: Note[]
  recurring_tasks: RecurringTask[]
  settings: Record<string, string>
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  title: string
  category_id?: string
  notes?: string
}

export interface UpdateTaskInput {
  id: string
  title?: string
  status?: Task['status']
  category_id?: string | null
  notes?: string | null
  priority?: number
  completed_at?: string
  carry_over_date?: string
}

export interface CreateSessionInput {
  task_id: string
  started_at: string
  ended_at: string
  duration_minutes: number
  outcome: PomodoroSession['outcome']
  block_note?: string
}

export interface JournalUpsertInput {
  date: string
  intention?: string | null
  narrative?: string | null
  mood?: number | null
}

export interface CreateNoteInput {
  title?: string
  content?: string
  task_id?: string
}

export interface UpdateNoteInput {
  id: string
  title?: string
  content?: string
  task_id?: string | null
  is_pinned?: number
}

export interface CategoryInput {
  label: string
  color: string
}

// ── UI / app state types ──────────────────────────────────────────────────────

export type Screen = 'board' | 'calendar' | 'journal' | 'notes' | 'analytics' | 'settings'

export type TimerPhase = 'work' | 'short-break' | 'long-break'

export interface TimerState {
  isRunning: boolean
  isPaused: boolean
  phase: TimerPhase
  remaining: number   // seconds
  totalDuration: number  // seconds (of current phase)
  sessionCount: number   // work sessions completed this cycle
  activeTask: Task | null
  startedAt: string | null
  endedAt: string | null
}

// ── Electron API bridge ───────────────────────────────────────────────────────

declare global {
  interface Window {
    api: {
      getCategories: () => Promise<Category[]>
      createCategory: (args: { label: string; color: string }) => Promise<Category>
      updateCategory: (args: { id: string; label?: string; color?: string }) => Promise<Category>
      deleteCategory: (id: string) => Promise<{ success: boolean }>

      getTodayTasks: () => Promise<Task[]>
      getCarryoverTasks: () => Promise<Task[]>
      getCompletedHistory: () => Promise<Task[]>
      createTask: (args: CreateTaskInput) => Promise<Task>
      updateTask: (args: UpdateTaskInput) => Promise<Task>
      deleteTask: (id: string) => Promise<{ success: boolean }>
      reorderTasks: (ids: string[]) => Promise<{ success: boolean }>
      resolveCarry: (id: string, action: 'keep' | 'drop') => Promise<{ success: boolean }>

      searchTasks: (query: string) => Promise<SearchResults>
      bulkUpdateTasks: (ids: string[], status: Task['status']) => Promise<{ success: boolean }>
      bulkDeleteTasks: (ids: string[]) => Promise<{ success: boolean }>

      createSession: (args: CreateSessionInput) => Promise<{ session_id: string; block_id: string }>
      getSessionsByDate: (date: string) => Promise<PomodoroSession[]>
      getSessionCountsByTask: () => Promise<Record<string, number>>
      getTodayStats: () => Promise<{ session_count: number; total_minutes: number }>
      getStreak: () => Promise<number>
      getStreakDetail: () => Promise<StreakDetail>

      getCalendarByDate: (date: string) => Promise<CalendarBlock[]>

      getJournalByDate: (date: string) => Promise<JournalEntry>
      upsertJournal: (args: JournalUpsertInput) => Promise<JournalEntry>

      getNotes: () => Promise<Note[]>
      getNote: (id: string) => Promise<Note>
      createNote: (args: CreateNoteInput) => Promise<Note>
      updateNote: (args: UpdateNoteInput) => Promise<Note>
      deleteNote: (id: string) => Promise<{ success: boolean }>

      getRecurringTasks: () => Promise<RecurringTask[]>
      createRecurringTask: (args: CreateRecurringTaskInput) => Promise<RecurringTask>
      updateRecurringTask: (args: UpdateRecurringTaskInput) => Promise<RecurringTask>
      deleteRecurringTask: (id: string) => Promise<{ success: boolean }>
      generateRecurringTasks: () => Promise<{ created: number }>

      getWeeklyStats: (days: number) => Promise<WeeklyStats[]>
      getCategoryBreakdown: (days: number) => Promise<CategoryBreakdown[]>
      getDailyHistory: (days: number) => Promise<Array<{ date: string; session_count: number; total_minutes: number }>>

      exportData: () => Promise<BackupData>
      importData: (data: string) => Promise<{ success: boolean }>

      getSettings: () => Promise<Settings>
      setSetting: (key: string, value: string) => Promise<{ success: boolean }>

      setLoginItem: (enabled: boolean) => Promise<{ success: boolean }>
      setWindowTitle: (title: string) => Promise<{ success: boolean }>
      setTrayTooltip: (tooltip: string) => Promise<{ success: boolean }>
    }
  }
}
