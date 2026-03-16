import { useState, useCallback, useRef } from 'react'
import { LayoutList, CalendarDays, BookOpen, StickyNote, BarChart3, Settings, ChevronLeft, Flame, Sun, Moon, HelpCircle } from 'lucide-react'
import logoSrc from '@/assets/logo.svg'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app.store'
import { useTaskStore } from '@/store/task.store'
import { usePomodoroStore } from '@/store/pomodoro.store'
import { getTheme, getOppositeThemeId } from '@/lib/themes'
import StreakPopover from './StreakPopover'
import type { Screen } from '@/types'

function getStreakMessage(streak: number): string {
  if (streak === 1) return 'First step!'
  if (streak === 2) return 'Two in a row!'
  if (streak <= 4) return 'Building momentum'
  if (streak <= 6) return 'On a roll!'
  if (streak === 7) return 'Full week!'
  if (streak <= 13) return 'Unstoppable!'
  if (streak === 14) return 'Two full weeks!'
  if (streak <= 20) return 'Locked in!'
  if (streak <= 29) return 'Machine mode!'
  if (streak === 30) return 'One month!'
  if (streak <= 59) return 'Incredible!'
  if (streak <= 99) return 'Legendary!'
  return 'Beyond limits!'
}

const NAV_ITEMS: Array<{ screen: Screen; icon: React.ElementType; label: string }> = [
  { screen: 'board',     icon: LayoutList,   label: "Today's Board" },
  { screen: 'calendar',  icon: CalendarDays, label: 'Calendar' },
  { screen: 'journal',   icon: BookOpen,     label: 'Journal' },
  { screen: 'notes',     icon: StickyNote,   label: 'Notes' },
  { screen: 'analytics', icon: BarChart3,    label: 'Analytics' },
]

export default function Sidebar() {
  const { screen, setScreen, theme, saveSetting, settings } = useAppStore()
  const streak = useTaskStore((s) => s.streak)
  const { isRunning, isPaused } = usePomodoroStore()
  const isDark = getTheme(theme).isDark
  const focusMode = settings?.focus_mode ?? 'dim'
  const isFocusing = (isRunning || isPaused) && focusMode !== 'off'
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(200)
  const [showStreakPopover, setShowStreakPopover] = useState(false)
  const dragging = useRef(false)
  const streakRef = useRef<HTMLDivElement>(null)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (collapsed) return
    e.preventDefault()
    dragging.current = true
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const newWidth = Math.max(140, Math.min(320, startWidth + (e.clientX - startX)))
      setSidebarWidth(newWidth)
    }

    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [collapsed, sidebarWidth])

  return (
    <div className="h-full flex flex-shrink-0">
    <aside
      className={cn(
        'h-full flex flex-col border-r border-[var(--border)] flex-shrink-0',
        'bg-[var(--bg-surface)]'
      )}
      style={{ width: collapsed ? 60 : sidebarWidth }}
    >
      {/* Logo + collapse */}
      <div className={cn(
        'flex items-center gap-2.5 px-4 h-14 border-b border-[var(--border)] flex-shrink-0',
        collapsed && 'justify-center px-0'
      )}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex-shrink-0 cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <img src={logoSrc} alt="LockIn" className="w-7 h-7 rounded-lg" />
        </button>
        {!collapsed && (
          <>
            <span className="font-display font-semibold text-sm text-[var(--text-primary)] tracking-tight flex-1">
              LockIn
            </span>
            <button
              onClick={() => setCollapsed(true)}
              className="h-6 w-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition-colors focus-ring"
              title="Collapse sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {NAV_ITEMS.map(({ screen: s, icon: Icon, label }) => {
          const active = screen === s
          const dimmed = isFocusing && s !== 'board'
          return (
            <button
              key={s}
              onClick={() => setScreen(s)}
              className={cn(
                'w-full flex items-center gap-3 rounded px-2.5 py-2 text-sm font-medium transition-all duration-100',
                'focus-ring',
                active
                  ? 'bg-[var(--accent-bg)] text-[var(--accent)] '
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
                collapsed && 'justify-center px-0',
                dimmed && 'opacity-30 pointer-events-none'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Streak indicator */}
      {streak > 0 && (
        <div className="relative mx-2 mb-2" ref={streakRef}>
          <button
            onClick={() => setShowStreakPopover((v) => !v)}
            className={cn(
              'w-full px-2.5 py-2 rounded-lg bg-[var(--bg-elevated)] cursor-pointer',
              'hover:bg-[var(--bg-elevated)]/80 transition-colors',
              collapsed && 'px-0 flex justify-center'
            )}
            title={collapsed ? `${streak} day streak` : undefined}
          >
            {collapsed ? (
              <div className="flex flex-col items-center gap-0.5">
                <Flame size={14} className="text-amber-400 animate-flame-pulse" />
                <span className="text-[10px] font-display font-bold text-amber-400 tabular-nums">{streak}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-amber-400 flex-shrink-0 animate-flame-pulse" />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-display font-semibold text-[var(--text-primary)] tabular-nums">{streak} day streak</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{getStreakMessage(streak)}</p>
                </div>
              </div>
            )}
          </button>
          {showStreakPopover && (
            <StreakPopover
              anchorRef={streakRef}
              onClose={() => setShowStreakPopover(false)}
            />
          )}
        </div>
      )}

      {/* Bottom: Help, Theme toggle + Settings */}
      <div className="py-3 px-2 space-y-0.5 border-t border-[var(--border)]">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))}
          className={cn(
            'w-full flex items-center gap-3 rounded px-2.5 py-2 text-sm font-medium transition-all duration-100',
            'focus-ring',
            'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Keyboard shortcuts' : undefined}
        >
          <HelpCircle size={16} className="flex-shrink-0" />
          {!collapsed && <span>Shortcuts</span>}
        </button>
        <button
          onClick={() => saveSetting('theme', getOppositeThemeId(theme))}
          className={cn(
            'w-full flex items-center gap-3 rounded px-2.5 py-2 text-sm font-medium transition-all duration-100',
            'focus-ring',
            'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? (isDark ? 'Switch to light' : 'Switch to dark') : undefined}
        >
          {isDark ? <Sun size={16} className="flex-shrink-0" /> : <Moon size={16} className="flex-shrink-0" />}
          {!collapsed && <span>{isDark ? 'Light mode' : 'Dark mode'}</span>}
        </button>
        <button
          onClick={() => setScreen('settings')}
          className={cn(
            'w-full flex items-center gap-3 rounded px-2.5 py-2 text-sm font-medium transition-all duration-100',
            'focus-ring',
            screen === 'settings'
              ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings size={16} className="flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
    {!collapsed && (
      <div
        onMouseDown={handleResizeStart}
        className="w-1 flex-shrink-0 cursor-col-resize hover:bg-accent-500/30 active:bg-accent-500/40 transition-colors"
      />
    )}
    </div>
  )
}
