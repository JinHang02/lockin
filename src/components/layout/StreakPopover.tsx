import { useEffect, useState, useRef, useMemo } from 'react'
import { Flame, Trophy, TrendingUp, ChevronLeft, ChevronRight, Shield } from 'lucide-react'
import type { StreakDetail } from '@/types'
import { useAppStore } from '@/store/app.store'

interface StreakPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
}

type RangeOption = 7 | 14 | 30 | 0

const RANGE_TABS: Array<{ value: RangeOption; label: string }> = [
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 0, label: 'History' },
]

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** Build an array of { date, active } for the last N days ending at today */
function buildRecentDays(activeDates: Set<string>, count: number) {
  const days: Array<{ date: string; active: boolean }> = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push({ date: dateStr, active: activeDates.has(dateStr) })
  }
  return days
}

/** Build month grid for a given year/month */
function buildMonthGrid(activeDates: Set<string>, year: number, month: number) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDow = new Date(year, month, 1).getDay()
  const days: Array<{ date: string; day: number; active: boolean }> = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ date: dateStr, day: d, active: activeDates.has(dateStr) })
  }
  return { days, firstDow }
}

export default function StreakPopover({ anchorRef, onClose }: StreakPopoverProps) {
  const [detail, setDetail] = useState<StreakDetail | null>(null)
  const settings = useAppStore((s) => s.settings)
  const saveSetting = useAppStore((s) => s.saveSetting)
  const savedRange = settings?.streak_range
  const [range, setRangeLocal] = useState<RangeOption>(() => {
    const v = Number(savedRange)
    return (v === 7 || v === 14 || v === 30 || v === 0) ? v : 7
  })
  const popoverRef = useRef<HTMLDivElement>(null)

  const setRange = (v: RangeOption) => {
    setRangeLocal(v)
    saveSetting('streak_range', String(v))
  }

  // For "History" monthly navigation
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  // Single fetch on mount — all display logic is computed locally
  useEffect(() => {
    window.api.getStreakDetail().then(setDetail).catch(() => {})
  }, [])

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Set of all active dates for quick lookup
  const activeSet = useMemo(
    () => new Set(detail?.allActiveDates ?? []),
    [detail]
  )

  // Recent days for 7d/14d/30d
  const recentDays = useMemo(
    () => (range > 0 ? buildRecentDays(activeSet, range) : []),
    [activeSet, range]
  )

  // Month grid for History mode
  const monthGrid = useMemo(
    () => (range === 0 ? buildMonthGrid(activeSet, viewYear, viewMonth) : null),
    [activeSet, range, viewYear, viewMonth]
  )

  const goMonthBack = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const goMonthForward = () => {
    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()
    if (isCurrentMonth) return
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()

  if (!detail) return null

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-0 mb-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-elevated z-50 p-3"
      style={{ width: range === 0 ? 260 : 224 }}
    >
      {/* Current & best streak */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1 rounded-md bg-[var(--bg-elevated)] px-2.5 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Flame size={12} className="text-amber-400" />
            <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums leading-none">{detail.current}</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">Current</p>
        </div>
        <div className="flex-1 rounded-md bg-[var(--bg-elevated)] px-2.5 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Trophy size={12} className="text-amber-400" />
            <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums leading-none">{detail.best}</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">Best</p>
        </div>
      </div>

      {/* Grace days indicator */}
      {settings?.streak_grace_days && parseInt(settings.streak_grace_days) > 0 && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
          <Shield size={11} />
          <span className="text-[10px] font-medium">
            {settings.streak_grace_days} grace day{parseInt(settings.streak_grace_days) > 1 ? 's' : ''} active
          </span>
        </div>
      )}

      {/* Range tabs */}
      <div className="flex items-center gap-0.5 mb-2 p-0.5 rounded-md bg-[var(--bg-elevated)]">
        {RANGE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setRange(tab.value)
              if (tab.value === 0) {
                setViewYear(now.getFullYear())
                setViewMonth(now.getMonth())
              }
            }}
            className={`flex-1 px-1.5 py-1 rounded text-[10px] font-medium transition-all duration-100 ${
              range === tab.value
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-subtle'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      <div>
        {range !== 0 ? (
          <>
            <div className="flex items-center gap-1 mb-1.5">
              <TrendingUp size={11} className="text-[var(--text-muted)]" />
              <p className="text-[10px] font-medium text-[var(--text-muted)]">Last {range} days</p>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((label, i) => (
                <div key={`h-${i}`} className="text-[9px] text-[var(--text-muted)] text-center leading-none pb-0.5">
                  {label}
                </div>
              ))}

              {/* Pad first row to align with day-of-week */}
              {recentDays.length > 0 && (() => {
                const firstDate = new Date(recentDays[0].date + 'T00:00:00')
                return Array.from({ length: firstDate.getDay() }, (_, i) => (
                  <div key={`pad-${i}`} />
                ))
              })()}

              {recentDays.map(({ date, active }) => (
                <div key={date} className="flex justify-center" title={formatTooltipDate(date)}>
                  <div
                    className={`w-4 h-4 rounded-sm ${
                      active
                        ? 'bg-amber-400/80'
                        : 'bg-[var(--bg-base)] border border-[var(--border)]'
                    }`}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* History monthly mode */}
            <div className="flex items-center justify-between mb-1.5">
              <button
                onClick={goMonthBack}
                className="p-0.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                <ChevronLeft size={13} />
              </button>
              <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                {formatMonthYear(viewYear, viewMonth)}
              </p>
              <button
                onClick={goMonthForward}
                disabled={isCurrentMonth}
                className={`p-0.5 rounded ${
                  isCurrentMonth
                    ? 'text-[var(--text-muted)]/30 cursor-not-allowed'
                    : 'hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
                title={isCurrentMonth ? "Can't go past current month" : 'Next month'}
              >
                <ChevronRight size={13} />
              </button>
            </div>

            {monthGrid && (
              <div className="grid grid-cols-7 gap-1">
                {DAY_LABELS.map((label, i) => (
                  <div key={`h-${i}`} className="text-[9px] text-[var(--text-muted)] text-center leading-none pb-0.5">
                    {label}
                  </div>
                ))}

                {Array.from({ length: monthGrid.firstDow }, (_, i) => (
                  <div key={`pad-${i}`} />
                ))}

                {monthGrid.days.map(({ date, day, active }) => (
                  <div key={date} className="flex justify-center" title={formatTooltipDate(date)}>
                    <div
                      className={`w-5 h-5 rounded-sm flex items-center justify-center text-[9px] ${
                        active
                          ? 'bg-amber-400/80 text-neutral-900 font-medium'
                          : 'bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-muted)]'
                      }`}
                    >
                      {day}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
