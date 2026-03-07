import { useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePomodoroStore } from '@/store/pomodoro.store'
import { formatTime } from '@/lib/utils'

export default function PomodoroHeader() {
  const {
    isRunning, isPaused, activeTask, remaining, totalDuration,
    phase, sessionCount, pauseSession, resumeSession, stopSession
  } = usePomodoroStore()
  const [confirmStop, setConfirmStop] = useState(false)

  const isVisible = isRunning || isPaused

  if (!isVisible) return null

  const progress = totalDuration > 0 ? (1 - remaining / totalDuration) : 0
  const progressPct = Math.min(100, progress * 100)

  const phaseLabel = phase === 'work'
    ? 'Focus'
    : phase === 'short-break'
    ? 'Short Break'
    : 'Long Break'

  return (
    <div className={cn(
      'flex-shrink-0 border-b border-[var(--border)]',
      'bg-[var(--bg-surface)]',
      'transition-all duration-200'
    )}>
      {/* Progress bar — fills across the full width */}
      <div className="h-0.5 w-full bg-[var(--border)]">
        <div
          className={cn(
            'h-full transition-all duration-1000 ease-linear',
            phase === 'work' ? 'bg-accent-500' : 'bg-emerald-500'
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Header content */}
      <div className="flex items-center gap-4 px-5 h-12">
        {/* Phase badge */}
        <span className={cn(
          'text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded',
          phase === 'work'
            ? 'text-accent-500 bg-[var(--accent-bg)]'
            : 'text-emerald-500 bg-emerald-500/10'
        )}>
          {phaseLabel}
        </span>

        {/* Task name */}
        {activeTask && (
          <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1 min-w-0">
            {activeTask.title}
          </span>
        )}

        <div className="flex items-center gap-3 ml-auto flex-shrink-0">
          {/* Session counter */}
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            #{sessionCount + 1}
          </span>

          {/* Countdown */}
          <span className={cn(
            'text-sm font-mono font-semibold tabular-nums',
            remaining <= 60 && phase === 'work'
              ? 'text-red-400'
              : 'text-[var(--text-primary)]'
          )}>
            {formatTime(remaining)}
          </span>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={isPaused ? resumeSession : pauseSession}
              className="h-7 w-7 rounded flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors focus-ring"
              title={isPaused ? 'Resume' : 'Pause'}
              aria-label={isPaused ? 'Resume timer' : 'Pause timer'}
            >
              {isPaused ? <Play size={13} /> : <Pause size={13} />}
            </button>
            {confirmStop ? (
              <div className="flex items-center gap-1 animate-fade-in">
                <button
                  onClick={() => { stopSession(); setConfirmStop(false) }}
                  className="h-7 px-2 rounded text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors focus-ring"
                >
                  Stop
                </button>
                <button
                  onClick={() => setConfirmStop(false)}
                  className="h-7 px-2 rounded text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors focus-ring"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmStop(true)}
                className="h-7 w-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors focus-ring"
                title="Stop session"
                aria-label="Stop session"
              >
                <Square size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
