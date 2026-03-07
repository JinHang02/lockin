import { ArrowRight, Trash2 } from 'lucide-react'
import { useTaskStore } from '@/store/task.store'
import Button from '@/components/ui/Button'

export default function CarryOverBanner() {
  const { carryoverTasks, carryoverResolved, resolveCarry } = useTaskStore()

  if (carryoverResolved || carryoverTasks.length === 0) return null

  return (
    <div className="flex-shrink-0 border-b border-amber-500/20 bg-amber-500/5 px-6 py-3 animate-slide-down">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
          Carry-over from yesterday
        </p>
        <div className="space-y-1.5">
          {carryoverTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-3 py-1"
            >
              <span className="text-sm text-[var(--text-primary)] truncate flex-1">
                {task.title}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resolveCarry(task.id, 'keep')}
                  className="text-accent-400 hover:text-accent-300 hover:bg-[var(--accent-bg)] gap-1.5"
                >
                  <ArrowRight size={12} />
                  Keep
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resolveCarry(task.id, 'drop')}
                  className="text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 gap-1.5"
                >
                  <Trash2 size={12} />
                  Drop
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
