import { useEffect, useState } from 'react'
import { useAppStore } from './store/app.store'
import { useTaskStore } from './store/task.store'
import { usePomodoroStore } from './store/pomodoro.store'
import Sidebar from './components/layout/Sidebar'
import PomodoroHeader from './components/layout/PomodoroHeader'
import TodayBoard from './components/board/TodayBoard'
import CalendarView from './components/calendar/CalendarView'
import JournalView from './components/journal/JournalView'
import SettingsView from './components/settings/SettingsView'
import OutcomeModal from './components/pomodoro/OutcomeModal'
import ShortcutOverlay from './components/ui/ShortcutOverlay'
import ToastContainer from './components/ui/Toast'
import { formatTime } from './lib/utils'

export default function App() {
  const { screen, settingsLoaded, loadSettings } = useAppStore()
  const { loadTasks, loadCategories, checkCarryover, loadSessionCounts, loadTodayStats, loadStreak } = useTaskStore()
  const { tick, setWorker, isRunning, isPaused, remaining, activeTask, showOutcome, pauseSession, resumeSession } = usePomodoroStore()
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Bootstrap
  useEffect(() => {
    loadSettings().then(() => {
      loadTasks()
      loadCategories()
      checkCarryover()
      loadSessionCounts()
      loadTodayStats()
      loadStreak()
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

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable

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

      // Escape: pause timer if running (safe — doesn't lose progress)
      if (e.key === 'Escape' && isRunning) {
        e.preventDefault()
        pauseSession()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRunning, isPaused, pauseSession, resumeSession])

  if (!settingsLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-6 h-6 rounded-full border-2 border-accent-500/30 border-t-accent-500 animate-spin" />
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
          {screen === 'board'    && <TodayBoard />}
          {screen === 'calendar' && <CalendarView />}
          {screen === 'journal'  && <JournalView />}
          {screen === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Outcome modal — shown when a work session timer completes */}
      {showOutcomeModal && <OutcomeModal />}

      {/* Keyboard shortcut overlay */}
      {showShortcuts && <ShortcutOverlay onClose={() => setShowShortcuts(false)} />}

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  )
}
