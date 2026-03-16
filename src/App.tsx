import { useEffect, useState, useRef, useCallback } from 'react'
import { useAppStore } from './store/app.store'
import { useTaskStore } from './store/task.store'
import { usePomodoroStore } from './store/pomodoro.store'
import Sidebar from './components/layout/Sidebar'
import PomodoroHeader from './components/layout/PomodoroHeader'
import TodayBoard from './components/board/TodayBoard'
import CalendarView from './components/calendar/CalendarView'
import JournalView from './components/journal/JournalView'
import NotesView from './components/notes/NotesView'
import AnalyticsView from './components/analytics/AnalyticsView'
import SettingsView from './components/settings/SettingsView'
import OutcomeModal from './components/pomodoro/OutcomeModal'
import SearchPalette from './components/ui/SearchPalette'
import ShortcutOverlay from './components/ui/ShortcutOverlay'
import ToastContainer from './components/ui/Toast'
import { formatTime, todayISO } from './lib/utils'

export default function App() {
  const { screen, setScreen, settingsLoaded, loadSettings, settings } = useAppStore()
  const { loadTasks, loadCategories, checkCarryover, loadSessionCounts, loadSubtaskCounts, loadTodayStats, loadStreak, tasks, todayStats } = useTaskStore()
  const { tick, setWorker, isRunning, isPaused, remaining, activeTask, showOutcome, pauseSession, resumeSession } = usePomodoroStore()
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Reminder tracking
  const lastNudgeRef = useRef<string>('')
  const lastDueReminderRef = useRef<string>('')

  // Bootstrap
  useEffect(() => {
    loadSettings().then(() => {
      loadTasks()
      loadCategories()
      checkCarryover()
      loadSessionCounts()
      loadSubtaskCounts()
      loadTodayStats()
      loadStreak()
      // Generate recurring tasks for today
      window.api.generateRecurringTasks().then(({ created }) => {
        if (created > 0) loadTasks()
      }).catch(() => {})
    })
  }, [])

  // Set up Web Worker for timer
  useEffect(() => {
    const worker = new Worker(new URL('./workers/timer.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'TICK') {
        tick(e.data.remaining)
      }
    }
    setWorker(worker)
    return () => {
      worker.terminate()
      setWorker(null)
    }
  }, [])

  // Update window title with timer
  useEffect(() => {
    if (isRunning || isPaused) {
      const title = `${formatTime(remaining)} — LockIn`
      document.title = title
      window.api.setWindowTitle(title).catch(() => {})
      window.api.setTrayTooltip(`${isPaused ? '⏸ ' : ''}${formatTime(remaining)} - ${activeTask?.title ?? 'Focus'}`).catch(() => {})
    } else {
      document.title = 'LockIn'
      window.api.setWindowTitle('LockIn').catch(() => {})
      window.api.setTrayTooltip('LockIn').catch(() => {})
    }
  }, [isRunning, isPaused, remaining, activeTask])

  // ── Reminder / Nudge system ──────────────────────────────────────────────
  const checkReminders = useCallback(() => {
    // Respect master toggle
    if (settings?.reminders_enabled === 'false') return

    const now = new Date()
    const hour = now.getHours()
    const today = todayISO()
    const dayOfWeek = now.getDay()
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

    // Don't show notifications if timer is running
    if (isRunning || isPaused) return

    // Nudge 1: No sessions today, weekday, after configured hour
    const nudgeEnabled = settings?.reminder_nudge_enabled !== 'false'
    const nudgeHour = parseInt(settings?.reminder_nudge_hour ?? '10', 10)
    if (nudgeEnabled && isWeekday && hour >= nudgeHour && todayStats.session_count === 0) {
      const nudgeKey = `nudge-${today}`
      if (lastNudgeRef.current !== nudgeKey) {
        lastNudgeRef.current = nudgeKey
        window.api.showNotification('LockIn', "You haven't started a focus session today. Time to lock in!")
      }
    }

    // Nudge 2: Tasks due today that aren't done, after configured hour
    const dueEnabled = settings?.reminder_due_enabled !== 'false'
    const dueHour = parseInt(settings?.reminder_due_hour ?? '9', 10)
    const dueTodayTasks = tasks.filter(t => t.due_date === today && t.status !== 'done')
    if (dueEnabled && dueTodayTasks.length > 0 && hour >= dueHour) {
      const dueKey = `due-${today}`
      if (lastDueReminderRef.current !== dueKey) {
        lastDueReminderRef.current = dueKey
        const names = dueTodayTasks.slice(0, 3).map(t => t.title).join(', ')
        const extra = dueTodayTasks.length > 3 ? ` and ${dueTodayTasks.length - 3} more` : ''
        window.api.showNotification('Tasks Due Today', `${names}${extra}`)
      }
    }
  }, [settings, isRunning, isPaused, todayStats, tasks])

  // Run reminders check every 30 minutes + once on boot after data loads
  useEffect(() => {
    if (!settingsLoaded) return
    // Initial check after a short delay to let data load
    const initialTimer = setTimeout(checkReminders, 5000)
    const interval = setInterval(checkReminders, 30 * 60 * 1000)
    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [settingsLoaded, checkReminders])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable

      // Ctrl+K: open search palette
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setShowSearch((v) => !v)
        return
      }

      // ? — show shortcut overlay (not in inputs)
      if (e.key === '?' && !isInput) {
        e.preventDefault()
        setShowShortcuts((v) => !v)
        return
      }

      // Space: pause/resume (only when timer is active and not in input)
      if (e.key === ' ' && !isInput && (isRunning || isPaused)) {
        e.preventDefault()
        if (isPaused) resumeSession()
        else pauseSession()
      }

      // Number keys 1-6: quick screen navigation (not in inputs)
      if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const screenMap: Record<string, typeof screen> = {
          '1': 'board', '2': 'calendar', '3': 'journal',
          '4': 'notes', '5': 'analytics', '6': 'settings',
        }
        if (screenMap[e.key]) {
          e.preventDefault()
          setScreen(screenMap[e.key])
          return
        }
      }

      // Escape: close search, or pause timer if running
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false)
          return
        }
        if (isRunning) {
          e.preventDefault()
          pauseSession()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRunning, isPaused, pauseSession, resumeSession, showSearch])

  if (!settingsLoaded) {
    return (
      <div className="h-full w-full flex" style={{ background: 'var(--bg-base)' }}>
        {/* Skeleton sidebar */}
        <div className="w-[200px] h-full border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col p-4 gap-3 flex-shrink-0">
          <div className="h-7 w-7 rounded-lg bg-[var(--bg-elevated)] animate-pulse" />
          <div className="flex-1 space-y-2 mt-4">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="h-8 rounded bg-[var(--bg-elevated)] animate-pulse" style={{ animationDelay: `${i * 100}ms`, width: `${60 + i * 8}%` }} />
            ))}
          </div>
        </div>
        {/* Skeleton main */}
        <div className="flex-1 p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="h-6 w-40 rounded bg-[var(--bg-elevated)] animate-pulse" />
            <div className="h-4 w-24 rounded bg-[var(--bg-elevated)] animate-pulse" style={{ animationDelay: '100ms' }} />
            <div className="h-20 rounded-lg bg-[var(--bg-elevated)] animate-pulse mt-6" style={{ animationDelay: '200ms' }} />
            {[1,2,3,4].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-[var(--bg-elevated)] animate-pulse" style={{ animationDelay: `${200 + i * 100}ms` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Show outcome modal when work session completes
  const showOutcomeModal = showOutcome

  return (
    <div className="h-full w-full flex overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Pomodoro header bar — only when session is active or paused */}
        <PomodoroHeader />

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          {screen === 'board'     && <TodayBoard />}
          {screen === 'calendar'  && <CalendarView />}
          {screen === 'journal'   && <JournalView />}
          {screen === 'notes'     && <NotesView />}
          {screen === 'analytics' && <AnalyticsView />}
          {screen === 'settings'  && <SettingsView />}
        </main>
      </div>

      {/* Focus mode overlay — only blocks other screens while timer is actively running */}
      {isRunning && settings?.focus_mode === 'zen' && screen !== 'board' && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center cursor-pointer animate-fade-in"
          onClick={() => useAppStore.getState().setScreen('board')}
        >
          <div className="text-center">
            <p className="text-lg font-semibold text-white/80">Focus Mode Active</p>
            <p className="text-sm text-white/50 mt-1">Click to return to your board</p>
          </div>
        </div>
      )}

      {/* Outcome modal — shown when a work session timer completes */}
      {showOutcomeModal && <OutcomeModal />}

      {/* Search palette */}
      {showSearch && (
        <SearchPalette
          onClose={() => setShowSearch(false)}
          onNavigateToTask={(taskId) => {
            setShowSearch(false)
            setScreen('board')
          }}
          onNavigateToJournal={(date) => {
            setShowSearch(false)
            setScreen('journal')
          }}
          onNavigateToNote={(noteId) => {
            setShowSearch(false)
            setScreen('notes')
          }}
        />
      )}

      {/* Keyboard shortcut overlay */}
      {showShortcuts && <ShortcutOverlay onClose={() => setShowShortcuts(false)} />}

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  )
}
