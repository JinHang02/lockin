import { useState } from 'react'
import { GripVertical, Play, Pencil, Trash2, Circle, CheckCircle2, AlertCircle, Timer } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
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

export default function TaskCard({ task, onEdit, onStartPomodoro, onStatusChange, done, isDragOverlay }: TaskCardProps) {
  const { deleteTask, sessionCounts } = useTaskStore()
  const sessionCount = sessionCounts[task.id] ?? 0
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: done
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const StatusIcon = STATUS_ICON[task.status]

  const handleDelete = async () => {
    await deleteTask(task.id)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg border transition-all duration-150',
        'bg-[var(--bg-surface)] border-[var(--border)]',
        isDragging ? 'opacity-0' : 'hover:border-[var(--border-strong)]',
        done && 'opacity-50'
      )}
    >
      {/* Drag handle */}
      {!done && (
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
          done && 'line-through text-[var(--text-muted)]'
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

        {(task.category_label || sessionCount > 0) && (
          <div className="mt-1.5 flex items-center gap-2">
            {task.category_label && (
              <Badge label={task.category_label} color={task.category_color ?? undefined} />
            )}
            {sessionCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] tabular-nums">
                <Timer size={10} />
                ×{sessionCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
          className="h-7 w-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors focus-ring"
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
            className="h-7 w-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors focus-ring"
            title="Delete task"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
