import { useState, useEffect } from 'react'
import { BarChart3, Clock, Target, Flame, TrendingUp, Award, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { cn, formatMinutes } from '@/lib/utils'
import type { WeeklyStats, CategoryBreakdown, TopTaskStat, HourlyDistribution } from '@/types'

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
] as const

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AnalyticsView() {
  const [days, setDays] = useState<number>(7)
  const [stats, setStats] = useState<WeeklyStats[]>([])
  const [categories, setCategories] = useState<CategoryBreakdown[]>([])
  const [streak, setStreak] = useState<number>(0)
  const [topTasks, setTopTasks] = useState<TopTaskStat[]>([])
  const [hourly, setHourly] = useState<HourlyDistribution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      window.api.getWeeklyStats(days),
      window.api.getCategoryBreakdown(days),
      window.api.getStreak(),
      window.api.getTopTasks(days),
      window.api.getHourlyDistribution(days),
    ]).then(([weeklyStats, catBreakdown, currentStreak, top, hourlyData]) => {
      setStats(weeklyStats)
      setCategories(catBreakdown)
      setStreak(currentStreak)
      setTopTasks(top)
      setHourly(hourlyData)
    }).catch(() => {}).finally(() => {
      setLoading(false)
    })
  }, [days])

  const totalMinutes = stats.reduce((sum, d) => sum + d.total_minutes, 0)
  const totalSessions = stats.reduce((sum, d) => sum + d.session_count, 0)
  const totalTasksCompleted = stats.reduce((sum, d) => sum + d.tasks_completed, 0)
  const maxMinutes = Math.max(...stats.map((d) => d.total_minutes), 1)
  const daysWithData = stats.filter(d => d.total_minutes > 0).length || 1
  const activeDays = stats.filter(d => d.total_minutes > 0).length
  const avgMinutes = Math.round(totalMinutes / daysWithData)
  const avgSessions = (totalSessions / daysWithData).toFixed(1)

  const maxCategoryMinutes = Math.max(...categories.map((c) => c.total_minutes), 1)

  // Best day of the week
  const dayTotals = Array.from({ length: 7 }, () => 0)
  stats.forEach((d) => {
    const day = new Date(d.date + 'T00:00:00').getDay()
    dayTotals[day] += d.total_minutes
  })
  const bestDayIdx = dayTotals.indexOf(Math.max(...dayTotals))
  const bestDayMinutes = dayTotals[bestDayIdx]

  // Consistency rate: what % of days in the range had at least one session
  const consistencyRate = Math.round((activeDays / Math.max(days, 1)) * 100)

  // Hourly distribution
  const maxHourlyMinutes = Math.max(...hourly.map(h => h.total_minutes), 1)

  // Top tasks max
  const topTaskMaxMinutes = topTasks.length > 0 ? topTasks[0].total_minutes : 1

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-display font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <BarChart3 size={18} />
            Analytics
          </h1>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-elevated)]">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-medium transition-all duration-150',
                  days === opt.value
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-subtle'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-[var(--text-muted)]">
            Loading analytics...
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                  <Clock size={13} />
                  <span className="text-xs font-medium uppercase tracking-wider">Focus time</span>
                </div>
                <p className="text-xl font-semibold text-[var(--text-primary)]">
                  {formatMinutes(totalMinutes)}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                  <BarChart3 size={13} />
                  <span className="text-xs font-medium uppercase tracking-wider">Sessions</span>
                </div>
                <p className="text-xl font-semibold text-[var(--text-primary)]">
                  {totalSessions}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                  <Target size={13} />
                  <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
                </div>
                <p className="text-xl font-semibold text-[var(--text-primary)]">
                  {totalTasksCompleted}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                  <Flame size={13} />
                  <span className="text-xs font-medium uppercase tracking-wider">Streak</span>
                </div>
                <p className="text-xl font-semibold text-[var(--text-primary)]">
                  {streak} {streak === 1 ? 'day' : 'days'}
                </p>
              </div>
            </div>

            {/* Daily focus chart */}
            <section>
              <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp size={13} /> Daily focus
              </h2>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                {stats.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] text-center py-8">
                    No sessions recorded in this period.
                  </p>
                ) : (
                  <div className="flex items-end gap-1.5" style={{ height: 160 }}>
                    {stats.map((day) => {
                      const heightPercent = (day.total_minutes / maxMinutes) * 100
                      const dateObj = new Date(day.date + 'T00:00:00')
                      const dayAbbr = format(dateObj, 'EEE')
                      const dayNum = format(dateObj, 'd')
                      return (
                        <div
                          key={day.date}
                          className="flex-1 flex flex-col items-center justify-end h-full min-w-0 group"
                        >
                          {/* Tooltip */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[var(--text-secondary)] mb-1 whitespace-nowrap pointer-events-none">
                            {formatMinutes(day.total_minutes)}
                          </div>
                          {/* Bar */}
                          <div
                            className="w-full max-w-[32px] rounded-t-md transition-all duration-300"
                            style={{
                              height: day.total_minutes > 0
                                ? `max(3px, ${heightPercent}%)`
                                : 0,
                              background: day.total_minutes > 0
                                ? 'linear-gradient(to top, var(--accent), var(--accent-bg))'
                                : 'var(--bg-elevated)',
                            }}
                          />
                          {/* Labels */}
                          <div className="mt-2 text-center leading-tight">
                            <div className="text-[10px] text-[var(--text-muted)]">{dayAbbr}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">{dayNum}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Top tasks */}
            {topTasks.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Award size={13} /> Top tasks by focus time
                </h2>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] divide-y divide-[var(--border)]">
                  {topTasks.map((task, idx) => {
                    const widthPercent = (task.total_minutes / topTaskMaxMinutes) * 100
                    return (
                      <div key={task.task_id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[var(--text-muted)] w-4 tabular-nums">
                              {idx + 1}
                            </span>
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: task.category_color ?? '#6366f1' }}
                            />
                            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                              {task.task_title}
                            </span>
                          </div>
                          <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                            {formatMinutes(task.total_minutes)} ({task.session_count} session{task.session_count !== 1 ? 's' : ''})
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden ml-6">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${widthPercent}%`,
                              backgroundColor: task.category_color ?? '#6366f1',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Hourly distribution */}
            {hourly.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Zap size={13} /> Focus by time of day
                </h2>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  <div className="flex items-end gap-1" style={{ height: 100 }}>
                    {Array.from({ length: 24 }, (_, h) => {
                      const data = hourly.find(d => d.hour === h)
                      const minutes = data?.total_minutes ?? 0
                      const heightPct = (minutes / maxHourlyMinutes) * 100
                      return (
                        <div key={h} className="flex-1 flex flex-col items-center justify-end h-full min-w-0 group">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-[var(--text-secondary)] mb-0.5 whitespace-nowrap pointer-events-none">
                            {minutes > 0 ? formatMinutes(minutes) : ''}
                          </div>
                          <div
                            className="w-full rounded-t-sm transition-all duration-300"
                            style={{
                              height: `${Math.max(heightPct, minutes > 0 ? 3 : 0)}%`,
                              backgroundColor: minutes > 0 ? 'var(--accent)' : 'var(--bg-elevated)',
                              opacity: minutes > 0 ? Math.max(0.3, heightPct / 100) : 1,
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] text-[var(--text-muted)]">12am</span>
                    <span className="text-[9px] text-[var(--text-muted)]">6am</span>
                    <span className="text-[9px] text-[var(--text-muted)]">12pm</span>
                    <span className="text-[9px] text-[var(--text-muted)]">6pm</span>
                    <span className="text-[9px] text-[var(--text-muted)]">11pm</span>
                  </div>
                </div>
              </section>
            )}

            {/* Category breakdown */}
            {categories.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BarChart3 size={13} /> Category breakdown
                </h2>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] divide-y divide-[var(--border)]">
                  {categories.map((cat) => {
                    const widthPercent = (cat.total_minutes / maxCategoryMinutes) * 100
                    return (
                      <div key={cat.category_label} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.category_color }}
                            />
                            <span className="text-sm font-medium text-[var(--text-primary)]">
                              {cat.category_label}
                            </span>
                          </div>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {formatMinutes(cat.total_minutes)} ({cat.session_count}{' '}
                            {cat.session_count === 1 ? 'session' : 'sessions'})
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${widthPercent}%`,
                              backgroundColor: cat.category_color,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Averages + insights */}
            <section>
              <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock size={13} /> Insights
              </h2>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] divide-y divide-[var(--border)]">
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-[var(--text-primary)]">Daily focus average</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {formatMinutes(avgMinutes)}
                  </p>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-[var(--text-primary)]">Sessions per active day</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{avgSessions}</p>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-[var(--text-primary)]">Active days</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{activeDays}/{days} ({consistencyRate}%)</p>
                </div>
                {bestDayMinutes > 0 && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm text-[var(--text-primary)]">Most productive day</p>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {DAY_NAMES[bestDayIdx]} ({formatMinutes(bestDayMinutes)})
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
