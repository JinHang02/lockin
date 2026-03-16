import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Clock, BarChart3, X, CalendarDays, Calendar, Rows3, Columns3 } from 'lucide-react'
import { format, addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import Button from '@/components/ui/Button'
import { todayISO, formatDateLabel, formatTimeRange, formatMinutes, colorWithOpacity, cn, localDateISO } from '@/lib/utils'
import type { CalendarBlock, CalendarDaySummary, Task } from '@/types'

const HOUR_HEIGHT = 56
const HOUR_WIDTH = 120
const DAY_START_HOUR = 0

type ViewMode = 'day' | 'week'
type DayLayout = 'vertical' | 'horizontal'

interface BlockDetail {
  block: CalendarBlock
  rect: DOMRect
}

export default function CalendarView() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('cal_viewMode') as ViewMode) || 'day')
  const [dayLayout, setDayLayout] = useState<DayLayout>(() => (localStorage.getItem('cal_dayLayout') as DayLayout) || 'vertical')
  const [date, setDate] = useState(todayISO())
  const [blocks, setBlocks] = useState<CalendarBlock[]>([])
  const [weekData, setWeekData] = useState<CalendarDaySummary[]>([])
  const [loading, setLoading] = useState(false)
  const [showMiniCal, setShowMiniCal] = useState(false)
  const [miniCalMonth, setMiniCalMonth] = useState(new Date())
  const [selectedBlock, setSelectedBlock] = useState<BlockDetail | null>(null)
  const [dueTasks, setDueTasks] = useState<Task[]>([])
  const timelineRef = useRef<HTMLDivElement>(null)
  const nowLineRef = useRef<HTMLDivElement>(null)

  // Compute week boundaries
  const weekStart = useMemo(() => {
    const d = new Date(date + 'T00:00:00')
    const dayOfWeek = d.getDay()
    const diff = d.getDate() - dayOfWeek
    const sunday = new Date(d)
    sunday.setDate(diff)
    return localDateISO(sunday)
  }, [date])

  const weekDays = useMemo(() => {
    const start = new Date(weekStart + 'T00:00:00')
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return localDateISO(d)
    })
  }, [weekStart])

  // Load day view data
  useEffect(() => {
    if (viewMode !== 'day') return
    setLoading(true)
    window.api.getCalendarByDate(date).then((data) => {
      setBlocks(data)
    }).catch(() => {
      setBlocks([])
    }).finally(() => {
      setLoading(false)
    })
    setSelectedBlock(null)
  }, [date, viewMode])

  // Load week view data
  useEffect(() => {
    if (viewMode !== 'week') return
    setLoading(true)
    const endDate = weekDays[weekDays.length - 1]
    Promise.all([
      window.api.getCalendarRange(weekStart, endDate),
      window.api.getTasksByDueRange(weekStart, endDate),
    ]).then(([data, tasks]) => {
      setWeekData(data)
      setDueTasks(tasks)
    }).catch(() => {
      setWeekData([])
      setDueTasks([])
    }).finally(() => {
      setLoading(false)
    })
  }, [weekStart, weekDays, viewMode])

  // Persist viewMode and dayLayout
  useEffect(() => { localStorage.setItem('cal_viewMode', viewMode) }, [viewMode])
  useEffect(() => { localStorage.setItem('cal_dayLayout', dayLayout) }, [dayLayout])

  // Scroll to current time on today
  const scrollToNow = useCallback(() => {
    setDate(todayISO())
    // Use requestAnimationFrame to wait for DOM update after potential date change
    requestAnimationFrame(() => {
      if (nowLineRef.current && timelineRef.current) {
        if (dayLayout === 'horizontal') {
          const scrollContainer = timelineRef.current.querySelector('.overflow-x-auto') as HTMLElement
          if (scrollContainer) {
            const nowOffset = nowLineRef.current.offsetLeft
            scrollContainer.scrollLeft = Math.max(0, nowOffset - scrollContainer.clientWidth / 2)
          }
        } else {
          const nowOffset = nowLineRef.current.offsetTop
          timelineRef.current.scrollTop = Math.max(0, nowOffset - 200)
        }
      }
    })
  }, [dayLayout])

  useEffect(() => {
    if (viewMode === 'day' && date === todayISO() && nowLineRef.current && timelineRef.current) {
      if (dayLayout === 'horizontal') {
        const scrollContainer = timelineRef.current.querySelector('.overflow-x-auto') as HTMLElement
        if (scrollContainer) {
          const nowOffset = nowLineRef.current.offsetLeft
          scrollContainer.scrollLeft = Math.max(0, nowOffset - scrollContainer.clientWidth / 2)
        }
      } else {
        const nowOffset = nowLineRef.current.offsetTop
        timelineRef.current.scrollTop = Math.max(0, nowOffset - 200)
      }
    }
  }, [date, loading, viewMode, dayLayout])

  // Update current-time line every minute
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const goToToday = () => setDate(todayISO())

  const goBack = () => {
    if (viewMode === 'week') {
      setDate(d => format(subDays(new Date(d + 'T00:00:00'), 7), 'yyyy-MM-dd'))
    } else {
      setDate(d => format(subDays(new Date(d + 'T00:00:00'), 1), 'yyyy-MM-dd'))
    }
  }

  const goForward = () => {
    if (viewMode === 'week') {
      setDate(d => format(addDays(new Date(d + 'T00:00:00'), 7), 'yyyy-MM-dd'))
    } else {
      setDate(d => format(addDays(new Date(d + 'T00:00:00'), 1), 'yyyy-MM-dd'))
    }
  }

  const totalFocusMinutes = blocks.reduce((sum, b) => sum + (b.duration_minutes ?? 0), 0)

  // Compute stats grouped by task
  const taskStats = blocks.reduce<Record<string, { color: string; label: string; minutes: number }>>((acc, b) => {
    const key = b.task_id
    if (!acc[key]) {
      acc[key] = { color: b.color_tag, label: b.task_title ?? 'Unknown', minutes: 0 }
    }
    acc[key].minutes += b.duration_minutes ?? 0
    return acc
  }, {})
  const statEntries = Object.values(taskStats).sort((a, b) => b.minutes - a.minutes)

  const isToday = date === todayISO()

  // Full 24-hour grid — no collapsing
  const allHours = Array.from({ length: 24 }, (_, i) => i + DAY_START_HOUR)

  type Segment = { type: 'hours'; hours: number[] }
  const segments: Segment[] = [{ type: 'hours', hours: allHours }]

  // Mini calendar
  const calStart = startOfWeek(startOfMonth(miniCalMonth), { weekStartsOn: 0 })
  const calEnd = endOfWeek(endOfMonth(miniCalMonth), { weekStartsOn: 0 })
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd })

  function handleBlockClick(block: CalendarBlock, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setSelectedBlock(prev => prev?.block.id === block.id ? null : { block, rect })
  }

  // Week view helpers
  const weekDataMap = useMemo(() => {
    const map = new Map<string, CalendarDaySummary>()
    for (const d of weekData) map.set(d.date, d)
    return map
  }, [weekData])

  const weekMaxMinutes = useMemo(() => {
    return Math.max(1, ...weekData.map(d => d.total_minutes))
  }, [weekData])

  const weekTotalMinutes = useMemo(() => {
    return weekData.reduce((sum, d) => sum + d.total_minutes, 0)
  }, [weekData])

  const weekTotalSessions = useMemo(() => {
    return weekData.reduce((sum, d) => sum + d.session_count, 0)
  }, [weekData])

  // Group due tasks by date
  const dueTasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of dueTasks) {
      if (!t.due_date) continue
      const arr = map.get(t.due_date) ?? []
      arr.push(t)
      map.set(t.due_date, arr)
    }
    return map
  }, [dueTasks])

  // Week header label
  const weekLabel = useMemo(() => {
    const start = new Date(weekDays[0] + 'T00:00:00')
    const end = new Date(weekDays[6] + 'T00:00:00')
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
    }
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }, [weekDays])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--border)] px-6 py-4 bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ChevronLeft size={16} />
          </Button>
          <div className="flex-1 text-center">
            {viewMode === 'day' ? (
              <>
                <button
                  onClick={() => { setShowMiniCal(!showMiniCal); setMiniCalMonth(new Date(date + 'T00:00:00')) }}
                  className="inline-flex items-center gap-1 hover:text-accent-400 transition-colors"
                >
                  <h2 className="text-base font-display font-semibold text-[var(--text-primary)]">
                    {formatDateLabel(date)}
                  </h2>
                </button>
                {totalFocusMinutes > 0 && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {formatMinutes(totalFocusMinutes)} focused · {blocks.length} session{blocks.length !== 1 ? 's' : ''}
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className="text-base font-display font-semibold text-[var(--text-primary)]">
                  {weekLabel}
                </h2>
                {weekTotalMinutes > 0 && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {formatMinutes(weekTotalMinutes)} focused · {weekTotalSessions} session{weekTotalSessions !== 1 ? 's' : ''}
                  </p>
                )}
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={goForward}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2 mt-2">
          {date !== todayISO() && (
            <button
              onClick={goToToday}
              className="text-xs text-accent-400 hover:text-accent-300 underline underline-offset-2 mr-3"
            >
              Go to today
            </button>
          )}

          {/* View mode toggle */}
          <div className="flex items-center bg-[var(--bg-elevated)] rounded-lg p-0.5 border border-[var(--border)]">
            <button
              onClick={() => setViewMode('day')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                viewMode === 'day'
                  ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <Calendar size={12} />
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                viewMode === 'week'
                  ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <CalendarDays size={12} />
              Week
            </button>
          </div>

          {/* Now button (day view only) */}
          {viewMode === 'day' && (
            <Button variant="ghost" size="sm" onClick={scrollToNow} title="Jump to now">
              <Clock size={13} />
              Now
            </Button>
          )}

          {/* Layout toggle (day view only) */}
          {viewMode === 'day' && (
            <button
              onClick={() => setDayLayout(dayLayout === 'vertical' ? 'horizontal' : 'vertical')}
              className="ml-2 h-7 w-7 rounded-md flex items-center justify-center border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title={dayLayout === 'vertical' ? 'Switch to horizontal' : 'Switch to vertical'}
            >
              {dayLayout === 'vertical' ? <Columns3 size={13} /> : <Rows3 size={13} />}
            </button>
          )}
        </div>

        {/* Mini calendar picker (day view only) */}
        {showMiniCal && viewMode === 'day' && (
          <div className="mt-3 flex justify-center">
            <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-3 shadow-elevated animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setMiniCalMonth(subMonths(miniCalMonth, 1))}
                  className="h-6 w-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {format(miniCalMonth, 'MMMM yyyy')}
                </span>
                <button
                  onClick={() => setMiniCalMonth(addMonths(miniCalMonth, 1))}
                  className="h-6 w-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <span key={i} className="text-[10px] text-[var(--text-muted)] text-center font-medium py-1">
                    {d}
                  </span>
                ))}
                {calDays.map((day) => {
                  const dayStr = format(day, 'yyyy-MM-dd')
                  const isSelected = dayStr === date
                  const isCurrentMonth = isSameMonth(day, miniCalMonth)
                  const isTodayDay = isSameDay(day, new Date())
                  return (
                    <button
                      key={dayStr}
                      onClick={() => { setDate(dayStr); setShowMiniCal(false) }}
                      className={cn(
                        'h-7 w-7 rounded text-xs transition-all',
                        !isCurrentMonth && 'opacity-30',
                        isSelected
                          ? 'bg-accent-500 text-white font-semibold'
                          : isTodayDay
                            ? 'bg-accent-500/10 text-accent-400 font-semibold'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Week View ─────────────────────────────────────────────── */}
      {viewMode === 'week' ? (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 rounded-full border-2 border-accent-500/30 border-t-accent-500 animate-spin" />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((dayStr) => {
                  const d = new Date(dayStr + 'T00:00:00')
                  const dayData = weekDataMap.get(dayStr)
                  const isTodayCell = dayStr === todayISO()
                  const minutes = dayData?.total_minutes ?? 0
                  const sessions = dayData?.session_count ?? 0
                  const intensity = minutes > 0 ? Math.max(0.08, Math.min(0.5, minutes / weekMaxMinutes * 0.5)) : 0

                  return (
                    <button
                      key={dayStr}
                      onClick={() => { setDate(dayStr); setViewMode('day') }}
                      className={cn(
                        'flex flex-col items-center rounded-xl border p-3 transition-all hover:border-[var(--border-strong)] hover:shadow-sm min-h-[160px]',
                        isTodayCell
                          ? 'border-accent-500/40 bg-[var(--accent-bg)]'
                          : 'border-[var(--border)] bg-[var(--bg-surface)]'
                      )}
                    >
                      {/* Day header */}
                      <span className={cn(
                        'text-[10px] font-semibold uppercase tracking-wider',
                        isTodayCell ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                      )}>
                        {format(d, 'EEE')}
                      </span>
                      <span className={cn(
                        'text-lg font-display font-semibold mt-0.5',
                        isTodayCell ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                      )}>
                        {format(d, 'd')}
                      </span>

                      {/* Heatmap circle */}
                      <div
                        className="w-10 h-10 rounded-full mt-3 flex items-center justify-center transition-all"
                        style={{
                          backgroundColor: intensity > 0
                            ? colorWithOpacity('#6366f1', intensity)
                            : 'var(--bg-elevated)',
                        }}
                      >
                        {minutes > 0 ? (
                          <span className="text-[10px] font-semibold text-accent-400 tabular-nums">
                            {formatMinutes(minutes)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)]">—</span>
                        )}
                      </div>

                      {/* Session count */}
                      {sessions > 0 && (
                        <span className="text-[10px] text-[var(--text-secondary)] mt-1.5 tabular-nums">
                          {sessions} session{sessions !== 1 ? 's' : ''}
                        </span>
                      )}

                      {/* Task color bars (sessions) */}
                      {dayData && dayData.tasks.length > 0 && (
                        <div className="flex flex-col gap-1 mt-2.5 w-full">
                          {dayData.tasks.slice(0, 3).map((task, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <div
                                className="h-1.5 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: task.color_tag,
                                  width: `${Math.max(12, (task.minutes / (dayData.total_minutes || 1)) * 100)}%`
                                }}
                              />
                              <span className="text-[9px] text-[var(--text-muted)] truncate flex-1">
                                {task.task_title}
                              </span>
                            </div>
                          ))}
                          {dayData.tasks.length > 3 && (
                            <span className="text-[9px] text-[var(--text-muted)]">
                              +{dayData.tasks.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Due tasks */}
                      {(() => {
                        const dayDueTasks = dueTasksByDate.get(dayStr)
                        if (!dayDueTasks || dayDueTasks.length === 0) return null
                        return (
                          <div className="flex flex-col gap-0.5 mt-2 w-full">
                            <span className="text-[8px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Due</span>
                            {dayDueTasks.slice(0, 2).map((t) => (
                              <div key={t.id} className="flex items-center gap-1">
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: t.category_color ?? 'var(--text-muted)' }}
                                />
                                <span className={cn(
                                  'text-[9px] truncate flex-1',
                                  t.status === 'done' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'
                                )}>
                                  {t.title}
                                </span>
                              </div>
                            ))}
                            {dayDueTasks.length > 2 && (
                              <span className="text-[9px] text-[var(--text-muted)]">
                                +{dayDueTasks.length - 2} more
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </button>
                  )
                })}
              </div>

              {/* Week summary */}
              {weekTotalMinutes > 0 && (
                <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                    Weekly Summary
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-2xl font-display font-bold text-[var(--text-primary)]">
                        {formatMinutes(weekTotalMinutes)}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">Total focus</p>
                    </div>
                    <div>
                      <p className="text-2xl font-display font-bold text-[var(--text-primary)]">
                        {weekTotalSessions}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">Sessions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-display font-bold text-[var(--text-primary)]">
                        {weekData.filter(d => d.total_minutes > 0).length}/7
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">Active days</p>
                    </div>
                  </div>

                  {/* Daily bar chart */}
                  <div className="flex items-end gap-2 mt-4 h-16">
                    {weekDays.map((dayStr) => {
                      const dayData = weekDataMap.get(dayStr)
                      const minutes = dayData?.total_minutes ?? 0
                      const height = weekMaxMinutes > 0 ? (minutes / weekMaxMinutes) * 100 : 0
                      const isTodayBar = dayStr === todayISO()
                      return (
                        <div key={dayStr} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full relative" style={{ height: 48 }}>
                            <div
                              className={cn(
                                'absolute bottom-0 w-full rounded-t transition-all duration-300',
                                isTodayBar ? 'bg-accent-400' : 'bg-accent-500/30'
                              )}
                              style={{ height: `${Math.max(height > 0 ? 4 : 0, height)}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-[var(--text-muted)]">
                            {format(new Date(dayStr + 'T00:00:00'), 'EEE')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {weekData.length === 0 && !loading && (
                <p className="text-center text-sm text-[var(--text-muted)] mt-8">
                  No focus sessions this week.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Day View ─────────────────────────────────────────────── */
        <div className="flex-1 flex overflow-hidden">
          {/* Timeline */}
          <div ref={timelineRef} className={cn('flex-1 px-6 py-4', dayLayout === 'vertical' ? 'overflow-y-auto' : 'overflow-x-auto overflow-y-hidden')}>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-5 h-5 rounded-full border-2 border-accent-500/30 border-t-accent-500 animate-spin" />
              </div>
            ) : dayLayout === 'vertical' ? (
              /* ── Vertical Layout ─────────────────────────── */
              <div className="max-w-xl mx-auto">
                {segments.map((seg, idx) => {
                  const segHours = seg.hours
                  const segStartHour = segHours[0]
                  const segHeight = segHours.length * HOUR_HEIGHT
                  return (
                    <div key={`seg-${idx}`} className="relative" style={{ height: segHeight }}>
                      {segHours.map((hour, hIdx) => (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 flex items-start gap-3"
                          style={{ top: hIdx * HOUR_HEIGHT }}
                        >
                          <span className="text-xs text-[var(--text-muted)] w-10 text-right flex-shrink-0 -mt-2">
                            {hour === 0 ? '12am' : hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
                          </span>
                          <div className="flex-1 border-t border-[var(--border)] mt-0" />
                        </div>
                      ))}

                      <div className="absolute" style={{ left: 52, right: 0 }}>
                        {(() => {
                          const segBlocks = blocks
                            .filter((block) => {
                              const startH = new Date(block.start_time).getHours()
                              return startH >= segStartHour && startH < segStartHour + segHours.length
                            })
                            .map((block) => {
                              const start = new Date(block.start_time)
                              const end = new Date(block.end_time)
                              const startMin = (start.getHours() - segStartHour) * 60 + start.getMinutes()
                              const durationMin = (end.getTime() - start.getTime()) / 60000
                              const top = (startMin / 60) * HOUR_HEIGHT
                              const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 20)
                              return { block, top, height }
                            })
                            .sort((a, b) => a.top - b.top || b.height - a.height)

                          const columns: number[] = new Array(segBlocks.length).fill(0)
                          const totalCols: number[] = new Array(segBlocks.length).fill(1)

                          const groups: number[][] = []
                          for (let i = 0; i < segBlocks.length; i++) {
                            let placed = false
                            for (const group of groups) {
                              const visuallyOverlaps = group.some(
                                (j) => segBlocks[i].top < segBlocks[j].top + segBlocks[j].height &&
                                       segBlocks[i].top + segBlocks[i].height > segBlocks[j].top
                              )
                              if (visuallyOverlaps) {
                                const usedCols = new Set(group.map((j) => columns[j]))
                                let col = 0
                                while (usedCols.has(col)) col++
                                columns[i] = col
                                group.push(i)
                                placed = true
                                break
                              }
                            }
                            if (!placed) {
                              groups.push([i])
                            }
                          }

                          for (const group of groups) {
                            const maxCol = Math.max(...group.map((i) => columns[i])) + 1
                            for (const i of group) totalCols[i] = maxCol
                          }

                          return segBlocks.map(({ block, top, height }, i) => {
                            const col = columns[i]
                            const cols = totalCols[i]
                            const widthPct = 100 / cols
                            const leftPct = col * widthPct

                            return (
                              <div
                                key={block.id}
                                style={{
                                  top,
                                  height,
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  position: 'absolute',
                                  backgroundColor: colorWithOpacity(block.color_tag, 0.15),
                                  borderLeft: `3px solid ${block.color_tag}`,
                                }}
                                className={cn(
                                  'rounded-r-md px-2 py-1 cursor-pointer overflow-hidden transition-all',
                                  'hover:shadow-sm hover:brightness-110',
                                  selectedBlock?.block.id === block.id && 'ring-2 ring-accent-500/40'
                                )}
                                title={`${block.task_title}\n${formatTimeRange(block.start_time, block.end_time)}${block.duration_minutes ? ` (${formatMinutes(block.duration_minutes)})` : ''}${block.outcome ? `\nOutcome: ${block.outcome === 'still-going' ? 'Still going' : block.outcome}` : ''}`}
                                onClick={(e) => handleBlockClick(block, e)}
                              >
                                {height >= 20 && (
                                  <>
                                    <p
                                      className="text-xs font-medium truncate"
                                      style={{ color: block.color_tag }}
                                    >
                                      {block.task_title}
                                    </p>
                                    <p className="text-xs opacity-70" style={{ color: block.color_tag }}>
                                      {formatTimeRange(block.start_time, block.end_time)}
                                    </p>
                                  </>
                                )}
                              </div>
                            )
                          })
                        })()}
                      </div>

                      {isToday && now.getHours() >= segStartHour && now.getHours() < segStartHour + segHours.length && (
                        <div
                          ref={nowLineRef}
                          className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                          style={{ top: ((now.getHours() - segStartHour) * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT }}
                        >
                          <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                          <div className="flex-1 border-t border-red-500" />
                        </div>
                      )}
                    </div>
                  )
                })}

                {blocks.length === 0 && !loading && (
                  <p className="text-center text-sm text-[var(--text-muted)] mt-8">
                    No focus sessions logged for this day.
                  </p>
                )}
              </div>
            ) : (
              /* ── Horizontal Layout ─────────────────────────── */
              <div className="h-full flex flex-col">
                {/* Scrollable horizontal timeline */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
                  <div className="relative" style={{ width: 24 * HOUR_WIDTH, minWidth: '100%' }}>
                    {/* Hour labels row — fixed at top */}
                    <div className="sticky top-0 z-20 flex border-b border-[var(--border)] bg-[var(--bg-surface)]" style={{ width: 24 * HOUR_WIDTH }}>
                      {allHours.map((hour) => (
                        <div
                          key={hour}
                          className="flex-shrink-0 border-l border-[var(--border)] px-2 py-1.5"
                          style={{ width: HOUR_WIDTH }}
                        >
                          <span className="text-[10px] font-medium text-[var(--text-muted)]">
                            {hour === 0 ? '12am' : hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Blocks area */}
                    <div className="relative" style={{ width: 24 * HOUR_WIDTH, height: 'calc(100vh - 240px)', minHeight: 200 }}>
                      {/* Hour grid lines */}
                      {allHours.map((hour) => (
                        <div
                          key={`line-${hour}`}
                          className="absolute top-0 bottom-0 border-l border-[var(--border)]"
                          style={{ left: hour * HOUR_WIDTH }}
                        />
                      ))}

                      {/* Session blocks */}
                      <div className="absolute inset-0" style={{ top: 8, bottom: 8 }}>
                        {(() => {
                          const hBlocks = blocks.map((block) => {
                            const start = new Date(block.start_time)
                            const end = new Date(block.end_time)
                            const startMin = start.getHours() * 60 + start.getMinutes()
                            const durationMin = (end.getTime() - start.getTime()) / 60000
                            const left = (startMin / 60) * HOUR_WIDTH
                            const width = Math.max((durationMin / 60) * HOUR_WIDTH, 24)
                            return { block, left, width }
                          }).sort((a, b) => a.left - b.left || b.width - a.width)

                          // Row assignment for overlapping blocks
                          const rows: number[] = new Array(hBlocks.length).fill(0)
                          const totalRows: number[] = new Array(hBlocks.length).fill(1)

                          const groups: number[][] = []
                          for (let i = 0; i < hBlocks.length; i++) {
                            let placed = false
                            for (const group of groups) {
                              const overlaps = group.some(
                                (j) => hBlocks[i].left < hBlocks[j].left + hBlocks[j].width &&
                                       hBlocks[i].left + hBlocks[i].width > hBlocks[j].left
                              )
                              if (overlaps) {
                                const usedRows = new Set(group.map((j) => rows[j]))
                                let row = 0
                                while (usedRows.has(row)) row++
                                rows[i] = row
                                group.push(i)
                                placed = true
                                break
                              }
                            }
                            if (!placed) {
                              groups.push([i])
                            }
                          }

                          for (const group of groups) {
                            const maxRow = Math.max(...group.map((i) => rows[i])) + 1
                            for (const i of group) totalRows[i] = maxRow
                          }

                          return hBlocks.map(({ block, left, width }, i) => {
                            const row = rows[i]
                            const rTotal = totalRows[i]
                            const heightPct = 100 / rTotal
                            const topPct = row * heightPct

                            return (
                              <div
                                key={block.id}
                                style={{
                                  left,
                                  width,
                                  top: `${topPct}%`,
                                  height: `${Math.min(heightPct, 50)}%`,
                                  maxHeight: 80,
                                  position: 'absolute',
                                  backgroundColor: colorWithOpacity(block.color_tag, 0.15),
                                  borderLeft: `3px solid ${block.color_tag}`,
                                }}
                                className={cn(
                                  'rounded-r-md px-2.5 py-1.5 cursor-pointer overflow-hidden transition-all',
                                  'hover:shadow-sm hover:brightness-110',
                                  selectedBlock?.block.id === block.id && 'ring-2 ring-accent-500/40'
                                )}
                                title={`${block.task_title}\n${formatTimeRange(block.start_time, block.end_time)}${block.duration_minutes ? ` (${formatMinutes(block.duration_minutes)})` : ''}${block.outcome ? `\nOutcome: ${block.outcome === 'still-going' ? 'Still going' : block.outcome}` : ''}`}
                                onClick={(e) => handleBlockClick(block, e)}
                              >
                                <p
                                  className="text-xs font-medium truncate"
                                  style={{ color: block.color_tag }}
                                >
                                  {block.task_title}
                                </p>
                                <p className="text-[10px] opacity-70 truncate" style={{ color: block.color_tag }}>
                                  {formatTimeRange(block.start_time, block.end_time)}
                                </p>
                              </div>
                            )
                          })
                        })()}
                      </div>

                      {/* Current time line */}
                      {isToday && (
                        <div
                          ref={nowLineRef}
                          className="absolute top-0 bottom-0 z-10 pointer-events-none"
                          style={{ left: (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_WIDTH }}
                        >
                          <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 -mt-1" />
                          <div className="w-px h-full bg-red-500 mx-auto" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {blocks.length === 0 && !loading && (
                  <p className="text-center text-sm text-[var(--text-muted)] mt-8">
                    No focus sessions logged for this day.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Daily stats sidebar */}
          {blocks.length > 0 && (
            <div className="w-52 flex-shrink-0 border-l border-[var(--border)] bg-[var(--bg-surface)] overflow-y-auto px-4 py-4">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BarChart3 size={12} />
                Stats
              </h3>

              <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">Total focus</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{formatMinutes(totalFocusMinutes)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">Sessions</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{blocks.length}</span>
                </div>
                {blocks.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">Avg session</span>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {formatMinutes(Math.round(totalFocusMinutes / blocks.length))}
                    </span>
                  </div>
                )}
              </div>

              <h4 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                By Task
              </h4>
              <div className="space-y-2">
                {statEntries.map((entry, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-xs text-[var(--text-primary)] truncate flex-1" title={entry.label}>
                        {entry.label}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
                        {formatMinutes(entry.minutes)}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden ml-4">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: entry.color,
                          width: `${totalFocusMinutes > 0 ? (entry.minutes / totalFocusMinutes) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Block detail panel */}
      {selectedBlock && (
        <div className="fixed inset-0 z-50" onClick={() => setSelectedBlock(null)}>
          <div
            className="absolute bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-elevated p-4 w-72 animate-fade-in"
            style={(() => {
              const popupW = 288
              const popupH = 160
              const margin = 8
              const r = selectedBlock.rect
              let top = r.bottom + margin
              let left = r.left
              if (left + popupW > window.innerWidth - margin) {
                left = window.innerWidth - popupW - margin
              }
              if (left < margin) left = margin
              if (top + popupH > window.innerHeight - margin) {
                top = r.top - popupH - margin
              }
              if (top < margin) top = margin
              return { left, top }
            })()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedBlock.block.color_tag }}
                />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {selectedBlock.block.task_title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBlock(null)}
                className="h-5 w-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <Clock size={12} />
                <span>{formatTimeRange(selectedBlock.block.start_time, selectedBlock.block.end_time)}</span>
              </div>
              {selectedBlock.block.duration_minutes != null && (
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <span>Duration</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {formatMinutes(selectedBlock.block.duration_minutes)}
                  </span>
                </div>
              )}
              {selectedBlock.block.outcome && (
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <span>Outcome</span>
                  <span className={cn(
                    'font-medium capitalize',
                    selectedBlock.block.outcome === 'done' ? 'text-emerald-500' :
                    selectedBlock.block.outcome === 'blocked' ? 'text-amber-400' :
                    'text-accent-400'
                  )}>
                    {selectedBlock.block.outcome === 'still-going' ? 'Still going' : selectedBlock.block.outcome}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
