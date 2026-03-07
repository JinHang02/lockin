import { Circle, Play, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import type { Task } from '@/types'

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

export default function TaskCardOverlay({ task }: { task: Task }) {
  const StatusIcon = STATUS_ICON[task.status]

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border',
        'bg-[var(--bg-surface)] border-accent-500/40',
        'shadow-elevated rotate-[1deg] scale-[1.02]',
        'cursor-grabbing'
      )}
    >
      <StatusIcon size={16} className={cn('mt-0.5 flex-shrink-0', STATUS_COLOR[task.status])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">
          {task.title}
        </p>
        {task.category_label && (
          <div className="mt-1.5">
            <Badge label={task.category_label} color={task.category_color ?? undefined} />
          </div>
        )}
      </div>
    </div>
  )
}
