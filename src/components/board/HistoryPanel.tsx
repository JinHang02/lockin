import { useState, useEffect } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { format, isYesterday, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'

interface HistoryPanelProps {
  onClose: () => void
}

function groupByDate(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const task of tasks) {
    const dateStr = task.completed_at ? task.completed_at.slice(0, 10) : 'unknown'
    const group = map.get(dateStr)
    if (group) group.push(task)
    else map.set(dateStr, [task])
  }
  return map
}

function formatDateLabel(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMM d')
}

export default function HistoryPanel({ onClose }: HistoryPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.getCompletedHistory().then((data) => {
      setTasks(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const grouped = groupByDate(tasks)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Panel */}
      <div
        className="relative mt-16 w-full max-w-md max-h-[70vh] rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-elevated flex flex-col animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-sm font-display font-semibold text-[var(--text-primary)]">Completed History</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{tasks.length} task{tasks.length !== 1 ? 's' : ''} from previous days</p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 rounded-full border-2 border-accent-500/30 border-t-accent-500 animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[var(--text-muted)]">No completed tasks yet.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Array.from(grouped.entries()).map(([dateStr, dateTasks]) => (
                <div key={dateStr}>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">
                    {formatDateLabel(dateStr)}
                  </p>
                  <div className="space-y-1">
                    {dateTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2.5 py-1.5 group"
                      >
                        <CheckCircle2 size={14} className="text-emerald-500/60 flex-shrink-0" />
                        <span className="flex-1 text-sm text-[var(--text-secondary)] line-through decoration-[var(--border)] truncate">
                          {task.title}
                        </span>
                        {task.category_label && (
                          <span className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: task.category_color ?? undefined }}
                            />
                            <span className="text-xs text-[var(--text-muted)]">{task.category_label}</span>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
