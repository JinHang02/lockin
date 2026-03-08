import { useState, useEffect } from 'react'
import { Repeat, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import type { RecurringTask, Category, CreateRecurringTaskInput } from '@/types'

const RECURRENCE_OPTIONS: { value: RecurringTask['recurrence']; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const RECURRENCE_LABELS: Record<RecurringTask['recurrence'], string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

interface RecurringTaskFormState {
  title: string
  recurrence: RecurringTask['recurrence']
  category_id: string
}

const EMPTY_FORM: RecurringTaskFormState = {
  title: '',
  recurrence: 'daily',
  category_id: '',
}

function RecurringTaskForm({
  initial,
  categories,
  onSave,
  onCancel,
}: {
  initial: RecurringTaskFormState
  categories: Category[]
  onSave: (form: RecurringTaskFormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<RecurringTaskFormState>(initial)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && form.title.trim()) onSave(form)
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="space-y-2">
      <input
        autoFocus
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Task title"
        className="w-full h-8 px-2 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
        onKeyDown={handleKeyDown}
      />
      <div className="flex gap-2">
        <select
          value={form.recurrence}
          onChange={(e) =>
            setForm({ ...form, recurrence: e.target.value as RecurringTask['recurrence'] })
          }
          className="h-8 px-2 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
        >
          {RECURRENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          className="flex-1 h-8 px-2 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
        >
          <option value="">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="accent" onClick={() => onSave(form)} disabled={!form.title.trim()}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function RecurringTaskRow({
  task,
  categories,
  onUpdate,
  onDelete,
  onRefresh,
}: {
  task: RecurringTask
  categories: Category[]
  onUpdate: (task: RecurringTask, form: RecurringTaskFormState) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRefresh: () => void
}) {
  const [editing, setEditing] = useState(false)

  const handleToggleActive = async () => {
    await window.api.updateRecurringTask({ id: task.id, active: task.active ? 0 : 1 })
    onRefresh()
  }

  const handleSave = async (form: RecurringTaskFormState) => {
    await onUpdate(task, form)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="py-2">
        <RecurringTaskForm
          initial={{
            title: task.title,
            recurrence: task.recurrence,
            category_id: task.category_id ?? '',
          }}
          categories={categories}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-2 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-medium truncate',
              task.active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] line-through'
            )}
          >
            {task.title}
          </span>
          <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
            {RECURRENCE_LABELS[task.recurrence]}
          </span>
        </div>
        {task.category_label && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: task.category_color ?? 'var(--text-muted)' }}
            />
            <span className="text-xs text-[var(--text-secondary)]">{task.category_label}</span>
          </div>
        )}
      </div>

      {/* Active toggle */}
      <button
        onClick={handleToggleActive}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-ring flex-shrink-0',
          task.active ? 'bg-accent-500' : 'bg-[var(--bg-overlay)]'
        )}
        title={task.active ? 'Deactivate' : 'Activate'}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
            task.active ? 'translate-x-4' : 'translate-x-1'
          )}
        />
      </button>

      {/* Edit / Delete (hover) */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="h-7 w-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors focus-ring"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="h-7 w-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors focus-ring"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

export default function RecurringTasksSection({ categories }: { categories: Category[] }) {
  const [tasks, setTasks] = useState<RecurringTask[]>([])
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchTasks = async () => {
    try {
      const data = await window.api.getRecurringTasks()
      setTasks(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const handleCreate = async (form: RecurringTaskFormState) => {
    const input: CreateRecurringTaskInput = {
      title: form.title.trim(),
      recurrence: form.recurrence,
    }
    if (form.category_id) input.category_id = form.category_id
    await window.api.createRecurringTask(input)
    setAdding(false)
    fetchTasks()
  }

  const handleUpdate = async (task: RecurringTask, form: RecurringTaskFormState) => {
    await window.api.updateRecurringTask({
      id: task.id,
      title: form.title.trim(),
      recurrence: form.recurrence,
      category_id: form.category_id || null,
    })
    fetchTasks()
  }

  const handleDelete = async (id: string) => {
    await window.api.deleteRecurringTask(id)
    fetchTasks()
  }

  return (
    <section>
      <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Repeat size={13} /> Recurring Tasks
      </h2>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] divide-y divide-[var(--border)]">
        {/* Task list */}
        <div className="px-4 py-1 divide-y divide-[var(--border)]">
          {loading ? (
            <p className="py-3 text-xs text-[var(--text-muted)]">Loading...</p>
          ) : tasks.length === 0 && !adding ? (
            <p className="py-3 text-xs text-[var(--text-muted)]">No recurring tasks configured.</p>
          ) : (
            tasks.map((task) => (
              <RecurringTaskRow
                key={task.id}
                task={task}
                categories={categories}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onRefresh={fetchTasks}
              />
            ))
          )}
        </div>

        {/* Add recurring task */}
        <div className="px-4 py-3">
          {adding ? (
            <RecurringTaskForm
              initial={EMPTY_FORM}
              categories={categories}
              onSave={handleCreate}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAdding(true)}
              className="w-full justify-start text-[var(--text-secondary)]"
            >
              <Plus size={13} />
              Add recurring task
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
