import { useState } from 'react'
import { LayoutList, CalendarDays, BookOpen, Settings, ChevronLeft, Flame } from 'lucide-react'
import logoSrc from '@/assets/logo.svg'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app.store'
import { useTaskStore } from '@/store/task.store'
import type { Screen } from '@/types'

const NAV_ITEMS: Array<{ screen: Screen; icon: React.ElementType; label: string }> = [
  { screen: 'board',    icon: LayoutList,   label: "Today's Board" },
  { screen: 'calendar', icon: CalendarDays, label: 'Calendar' },
  { screen: 'journal',  icon: BookOpen,     label: 'Journal' },
]

export default function Sidebar() {
  const { screen, setScreen } = useAppStore()
  const streak = useTaskStore((s) => s.streak)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'h-full flex flex-col border-r border-[var(--border)] transition-all duration-200 ease-smooth flex-shrink-0',
        'bg-[var(--bg-surface)]',
        collapsed ? 'w-[60px]' : 'w-[200px]'
      )}
    >
      {/* Logo + collapse */}
      <div className={cn(
        'flex items-center gap-2.5 px-4 h-14 border-b border-[var(--border)] flex-shrink-0',
        collapsed && 'justify-center px-0'
      )}>
        <button
          onClick={collapsed ? () => setCollapsed(false) : undefined}
          className={cn(
            'flex-shrink-0',
            collapsed && 'cursor-pointer'
          )}
          title={collapsed ? 'Expand sidebar' : undefined}
        >
          <img src={logoSrc} alt="LockIn" className="w-7 h-7 rounded-lg" />
        </button>
        {!collapsed && (
          <>
            <span className="font-semibold text-sm text-[var(--text-primary)] tracking-tight flex-1">
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
                collapsed && 'justify-center px-0'
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
        <div className={cn(
          'mx-2 mb-2 px-2.5 py-2 rounded-lg bg-[var(--bg-elevated)]',
          collapsed && 'mx-auto px-0 flex justify-center'
        )}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-0.5" title={`${streak} day streak`}>
              <Flame size={14} className="text-amber-400" />
              <span className="text-[10px] font-bold text-amber-400 tabular-nums">{streak}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Flame size={14} className="text-amber-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{streak} day streak</p>
                <p className="text-[10px] text-[var(--text-muted)]">Keep it going!</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom: Settings + collapse */}
      <div className="py-3 px-2 space-y-0.5 border-t border-[var(--border)]">
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
  )
}
