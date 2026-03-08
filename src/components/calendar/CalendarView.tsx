import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Clock, BarChart3, X } from 'lucide-react'
import { format, addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import Button from '@/components/ui/Button'
import { todayISO, formatDateLabel, formatTimeRange, formatMinutes, colorWithOpacity, cn } from '@/lib/utils'
import type { CalendarBlock } from '@/types'

const HOUR_HEIGHT = 56
const DAY_START_HOUR = 6

interface BlockDetail {
  block: CalendarBlock
  rect: DOMRect
}

export default function CalendarView() {
  const [date, setDate] = useState(todayISO())
  const [blocks, setBlocks] = useState<CalendarBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [showMiniCal, setShowMiniCal] = useState(false)
  const [miniCalMonth, setMiniCalMonth] = useState(new Date())
  const [selectedBlock, setSelectedBlock] = useState<BlockDetail | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const nowLineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    window.api.getCalendarByDate(date).then((data) => {
      setBlocks(data)
    }).catch(() => {
      setBlocks([])
    }).finally(() => {
      setLoading(false)
    })
    setSelectedBlock(null)
  }, [date])

  // Scroll to current time on today
  useEffect(() => {
    if (date === todayISO() && nowLineRef.current && timelineRef.current) {
      const nowOffset = nowLineRef.current.offsetTop
      timelineRef.current.scrollTop = Math.max(0, nowOffset - 200)
    }
  }, [date, loading])

  // Update current-time line every minute
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const goToToday = () => setDate(todayISO())
  const goBack = () => setDate((d) => format(subDays(new Date(d + 'T00:00:00'), 1), 'yyyy-MM-dd'))
  const goForward = () => setDate((d) => format(addDays(new Date(d + 'T00:00:00'), 1), 'yyyy-MM-dd'))

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

  // Hours to show — collapse empty ranges
  const allHours = Array.from({ length: 18 }, (_, i) => i + DAY_START_HOUR)
  const occupiedHours = new Set<number>()
  blocks.forEach((b) => {
    const start = new Date(b.start_time)
    const end = new Date(b.end_time)
    for (let h = start.getHours(); h <= end.getHours(); h++) {
      occupiedHours.add(h)
    }
  })
  // Always show current hour on today
  if (isToday) occupiedHours.add(now.getHours())

  // Determine collapsed ranges — collapse a stretch of 3+ consecutive empty hours
  type Segment = { type: 'hours'; hours: number[] } | { type: 'gap'; from: number; to: number }
  const segments: Segment[] = []
  let emptyBuffer: number[] = []

  function flushEmpty() {
    if (emptyBuffer.length >= 3 && blocks.length > 0) {
      segments.push({ type: 'gap', from: emptyBuffer[0], to: emptyBuffer[emptyBuffer.length - 1] })
    } else {
      for (const h of emptyBuffer) {
        const last = segments[segments.length - 1]
        if (last && last.type === 'hours') {
          last.hours.push(h)
        } else {
          segments.push({ type: 'hours', hours: [h] })
        }
      }
    }
    emptyBuffer = []
  }

  for (const h of allHours) {
    // Include hour if occupied, or within 1 hour of occupied, or if it's current hour on today
    const nearOccupied = occupiedHours.has(h) || occupiedHours.has(h - 1) || occupiedHours.has(h + 1)
    if (nearOccupied) {
      flushEmpty()
      const last = segments[segments.length - 1]
      if (last && last.type === 'hours') {
        last.hours.push(h)
      } else {
        segments.push({ type: 'hours', hours: [h] })
      }
    } else {
      emptyBuffer.push(h)
    }
  }
  flushEmpty()

  // Mini calendar
  const calStart = startOfWeek(startOfMonth(miniCalMonth), { weekStartsOn: 0 })
  const calEnd = endOfWeek(endOfMonth(miniCalMonth), { weekStartsOn: 0 })
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd })

  function handleBlockClick(block: CalendarBlock, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setSelectedBlock(prev => prev?.block.id === block.id ? null : { block, rect })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--border)] px-6 py-4 bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ChevronLeft size={16} />
          </Button>
          <div className="flex-1 text-center">
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
          </div>
          <Button variant="ghost" size="icon" onClick={goForward}>
            <ChevronRight size={16} />
          </Button>
        </div>
        {date !== todayISO() && (
          <div className="text-center mt-1.5">
            <button
              onClick={goToToday}
              className="text-xs text-accent-400 hover:text-accent-300 underline underline-offset-2"
            >
              Go to today
            </button>
          </div>
        )}

        {/* Mini calendar picker */}
        {showMiniCal && (
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

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Timeline */}
        <div ref={timelineRef} className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 rounded-full border-2 border-accent-500/30 border-t-accent-500 animate-spin" />
            </div>
          ) : (
            <div className="max-w-xl mx-auto">
              {/* Render segments */}
              {segments.map((seg, idx) => {
                if (seg.type === 'gap') {
                  return (
                    <div
                      key={`gap-${idx}`}
                      className="flex items-center gap-3 py-2"
                    >
                      <span className="text-xs text-[var(--text-muted)] w-10 text-right flex-shrink-0">
                        ···
                      </span>
                      <div className="flex-1 border-t border-dashed border-[var(--border)]" />
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {seg.to - seg.from + 1}h empty
                      </span>
                    </div>
                  )
                }
                const segHours = seg.hours
                const segStartHour = segHours[0]
                const segHeight = segHours.length * HOUR_HEIGHT
                return (
                  <div key={`seg-${idx}`} className="relative" style={{ height: segHeight }}>
                    {/* Hour lines */}
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

                    {/* Calendar blocks in this segment */}
                    <div className="absolute" style={{ left: 52, right: 0 }}>
                      {blocks
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
                          const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 24)
                          return (
                            <div
                              key={block.id}
                              style={{
                                top,
                                height,
                                left: 0,
                                right: 0,
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
                              <p
                                className="text-xs font-medium truncate"
                                style={{ color: block.color_tag }}
                              >
                                {block.task_title}
                              </p>
                              <p className="text-xs opacity-70" style={{ color: block.color_tag }}>
                                {formatTimeRange(block.start_time, block.end_time)}
                              </p>
                            </div>
                          )
                        })}
                    </div>

                    {/* Current time indicator */}
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
          )}
        </div>

        {/* Daily stats sidebar — only when there are blocks */}
        {blocks.length > 0 && (
          <div className="w-52 flex-shrink-0 border-l border-[var(--border)] bg-[var(--bg-surface)] overflow-y-auto px-4 py-4">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BarChart3 size={12} />
              Stats
            </h3>

            {/* Summary */}
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

            {/* By category */}
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
                    <span className="text-xs text-[var(--text-primary)] truncate flex-1">
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
              // Try below the block first
              let top = r.bottom + margin
              let left = r.left
              // If overflows right, shift left
              if (left + popupW > window.innerWidth - margin) {
                left = window.innerWidth - popupW - margin
              }
              // If overflows left, clamp to margin
              if (left < margin) left = margin
              // If overflows bottom, show above the block
              if (top + popupH > window.innerHeight - margin) {
                top = r.top - popupH - margin
              }
              // If still overflows top, just clamp
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
