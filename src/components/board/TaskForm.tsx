import { useState } from 'react'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import { useTaskStore } from '@/store/task.store'
import { useToastStore } from '@/store/toast.store'
import type { Task } from '@/types'

interface TaskFormProps {
  task: Task | null
  onClose: () => void
}

export default function TaskForm({ task, onClose }: TaskFormProps) {
  const { categories, createTask, updateTask, deleteTask } = useTaskStore()
  const addToast = useToastStore((s) => s.addToast)
  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [categoryId, setCategoryId] = useState(task?.category_id ?? '')
  const [loading, setLoading] = useState(false)

  const isEditing = task !== null

  const handleSubmit = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      if (isEditing) {
        await updateTask({
          id: task.id,
          title: title.trim(),
          notes: notes.trim() || null,
          category_id: categoryId || null
        })
        addToast('Task updated')
      } else {
        await createTask({
          title: title.trim(),
          notes: notes.trim() || undefined,
          category_id: categoryId || undefined
        })
        addToast('Task created')
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    await deleteTask(task.id)
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEditing ? 'Edit task' : 'New task'}
    >
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Task title <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need to do?"
            className="w-full h-9 px-3 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Notes <span className="text-[var(--text-muted)]">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details..."
            rows={3}
            className="w-full px-3 py-2 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-accent-500/40 resize-none"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Category
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full h-9 px-3 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {isEditing && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim() || loading}
          >
            {isEditing ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
