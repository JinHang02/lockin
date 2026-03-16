import { useState, useRef, useEffect } from 'react'
import { GripVertical, Play, Pencil, Trash2, Circle, CheckCircle2, AlertCircle, Timer, CalendarClock, ListChecks } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn, todayISO } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import { useTaskStore } from '@/store/task.store'
import type { Task } from '@/types'

interface TaskCardProps {
  task: Task
  onEdit: () => void
  onStartPomodoro: () => void
  onStatusChange: (status: Task['status']) => void
  done?: boolean
  isDragOverlay?: boolean
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  focused?: boolean
}

const STATUS_ICON: Record<Task['status'], React.ElementType> = {
  'todo':        Circle,
  'in-progress': Play,
  'done':        CheckCircle2,
  'blocked':     AlertCircle,
}

const STATUS_COLOR: Record<Task['status'], string> = {
  'todo':        'text-[var(--text-muted)]',
  'in-progress': 'text-accent-400',
  'done':        'text-emerald-500',
  'blocked':     'text-amber-400',
}

function getDueDateInfo(dueDate: string | null, status: string): { label: string; color: string } | null {
  if (!dueDate || status === 'done') return null
  const today = todayISO()
  if (dueDate < today) {
    const daysDiff = Math.floor((new Date(today + 'T00:00:00').getTime() - new Date(dueDate + 'T00:00:00').getTime()) / 86400000)
    return { label: `${daysDiff}d overdue`, color: 'text-red-400 bg-red-500/10' }
  }
  if (dueDate === today) {
    return { label: 'Due today', color: 'text-amber-400 bg-amber-500/10' }
  }
  const daysDiff = Math.floor((new Date(dueDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)
  if (daysDiff === 1) return { label: 'Due tomorrow', color: 'text-[var(--text-secondary)] bg-[var(--bg-elevated)]' }
  if (daysDiff <= 3) return { label: `Due in ${daysDiff}d`, color: 'text-[var(--text-secondary)] bg-[var(--bg-elevated)]' }
  return null
}

export default function TaskCard({ task, onEdit, onStartPomodoro, onStatusChange, done, isDragOverlay, selectionMode, selected, onToggleSelect, focused }: TaskCardProps) {
  const { deleteTask, sessionCounts, subtaskCounts } = useTaskStore()
  const sessionCount = sessionCounts[task.id] ?? 0
  const subtaskInfo = subtaskCounts[task.id]
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const prevStatus = useRef(task.status)

  const cardRef = useRef<HTMLDivElement>(null)

  // Detect status transition to 'done' for animation
  useEffect(() => {
    if (task.status === 'done' && prevStatus.current !== 'done') {
      setJustCompleted(true)
      const timer = setTimeout(() => setJustCompleted(false), 500)
      return () => clearTimeout(timer)
    }
    prevStatus.current = task.status
  }, [task.status])

  // Auto-scroll into view when focused via keyboard
  useEffect(() => {
    if (focused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focused])

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: done
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const StatusIcon = STATUS_ICON[task.status]
  const dueDateInfo = getDueDateInfo(task.due_date, task.status)

  const handleDelete = async () => {
    await deleteTask(task.id)
  }

  return (
    <div
      ref={(node) => { setNodeRef(node); (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node }}
      style={style}
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg border transition-all duration-150',
        'bg-[var(--bg-surface)] border-[var(--border)]',
        isDragging ? 'opacity-0' : 'hover:border-[var(--border-strong)]',
        done && 'border-l-2 border-l-emerald-500/70 scale-[0.98] origin-left opacity-85',
        selected && 'border-accent-500/50 bg-[var(--accent-bg)]',
        justCompleted && 'animate-task-complete',
        dueDateInfo?.color.includes('red') && !done && 'border-l-2 border-l-red-400/60 bg-red-500/[0.03]',
        focused && 'ring-2 ring-accent-500/50 border-accent-500/30'
      )}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.() }}
          className={cn(
            'mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-all focus-ring',
            selected
              ? 'bg-accent-500 border-accent-500 text-white'
              : 'border-[var(--border-strong)] hover:border-accent-400'
          )}
          aria-label={selected ? 'Deselect task' : 'Select task'}
        >
          {selected && (
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}

      {/* Drag handle */}
      {!done && !selectionMode && (
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-grab active:cursor-grabbing focus-ring rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
      )}

      {/* Status toggle */}
      <button
        onClick={() =>
          onStatusChange(task.status === 'done' ? 'todo' : 'done')
        }
        className={cn('mt-0.5 flex-shrink-0 transition-colors focus-ring rounded', STATUS_COLOR[task.status])}
        title={`Status: ${task.status}`}
        aria-label={task.status === 'done' ? 'Mark as todo' : 'Mark as done'}
      >
        <StatusIcon size={16} aria-hidden="true" />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium text-[var(--text-primary)] leading-snug',
          done && 'line-through text-[var(--text-secondary)]'
        )}>
          {task.title}
        </p>

        {task.notes && (
          <div className="relative">
            <p
              className="text-xs text-[var(--text-secondary)] mt-0.5 truncate cursor-help"
              onMouseEnter={() => setShowNotes(true)}
              onMouseLeave={() => setShowNotes(false)}
            >
              {task.notes}
            </p>
            {showNotes && task.notes.length > 60 && (
              <div className="absolute left-0 top-full mt-1 z-40 max-w-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-elevated text-xs text-[var(--text-primary)] whitespace-pre-wrap animate-fade-in">
                {task.notes}
              </div>
            )}
          </div>
        )}

        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {task.category_label && (
            <Badge label={task.category_label} color={task.category_color ?? undefined} />
          )}
          {(sessionCount > 0 || task.session_goal) && (
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] tabular-nums px-1.5 py-0.5 rounded',
              task.session_goal && sessionCount >= task.session_goal
                ? 'text-emerald-500 bg-emerald-500/10'
                : 'text-[var(--text-muted)] bg-[var(--bg-elevated)]'
            )}>
              <Timer size={10} />
              {task.session_goal ? `${sessionCount}/${task.session_goal}` : `×${sessionCount}`}
            </span>
          )}
          {subtaskInfo && subtaskInfo.total > 0 && (
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] tabular-nums px-1.5 py-0.5 rounded',
              subtaskInfo.done === subtaskInfo.total
                ? 'text-emerald-500 bg-emerald-500/10'
                : 'text-[var(--text-muted)] bg-[var(--bg-elevated)]'
            )}>
              <ListChecks size={10} />
              {subtaskInfo.done}/{subtaskInfo.total}
            </span>
          )}
          {dueDateInfo && (
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded',
              dueDateInfo.color
            )}>
              <CalendarClock size={10} />
              {dueDateInfo.label}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!done && (
          <button
            onClick={onStartPomodoro}
            className="h-7 w-7 rounded flex items-center justify-center text-accent-400 hover:bg-[var(--accent-bg)] transition-colors focus-ring"
            title="Start Pomodoro"
          >
            <Play size={12} />
          </button>
        )}
        <button
          onClick={onEdit}
          className="h-7 w-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors focus-ring opacity-0 group-hover:opacity-100 transition-opacity"
          title="Edit task"
        >
          <Pencil size={12} />
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1 animate-fade-in">
            <button
              onClick={handleDelete}
              className="h-7 px-2 rounded text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors focus-ring"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="h-7 px-2 rounded text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors focus-ring"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="h-7 w-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors focus-ring opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete task"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
