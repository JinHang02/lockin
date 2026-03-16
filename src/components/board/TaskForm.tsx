import { useState, useEffect } from 'react'
import { Plus, X, CheckSquare, Square, BookTemplate, ChevronDown, Trash2, ChevronUp } from 'lucide-react'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import { useTaskStore } from '@/store/task.store'
import { useToastStore } from '@/store/toast.store'
import { cn } from '@/lib/utils'
import type { Task, Subtask, TaskTemplate } from '@/types'

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
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [sessionGoal, setSessionGoal] = useState(task?.session_goal?.toString() ?? '')
  const [loading, setLoading] = useState(false)

  // Subtask state
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [pendingSubtasks, setPendingSubtasks] = useState<string[]>([])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [subtaskLoading, setSubtaskLoading] = useState(false)

  // Template state
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)

  const isEditing = task !== null

  // Load subtasks when editing
  useEffect(() => {
    if (task) {
      window.api.getSubtasks(task.id).then(setSubtasks).catch(() => {})
    }
  }, [task])

  // Load templates
  useEffect(() => {
    window.api.getTaskTemplates().then(setTemplates).catch(() => {})
  }, [])

  const handleSubmit = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      if (isEditing) {
        await updateTask({
          id: task.id,
          title: title.trim(),
          notes: notes.trim() || null,
          category_id: categoryId || null,
          due_date: dueDate || null,
          session_goal: sessionGoal ? parseInt(sessionGoal, 10) : null
        })
        addToast('Task updated')
      } else {
        const created = await createTask({
          title: title.trim(),
          notes: notes.trim() || undefined,
          category_id: categoryId || undefined,
          due_date: dueDate || undefined,
          session_goal: sessionGoal ? parseInt(sessionGoal, 10) : undefined
        })
        // Create pending subtasks for the new task
        for (const st of pendingSubtasks) {
          await window.api.createSubtask({ task_id: created.id, title: st })
        }
        addToast('Task created')
      }
      useTaskStore.getState().loadSubtaskCounts()
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

  const handleAddSubtask = async () => {
    if (!task || !newSubtaskTitle.trim()) return
    setSubtaskLoading(true)
    try {
      const created = await window.api.createSubtask({ task_id: task.id, title: newSubtaskTitle.trim() })
      setSubtasks(prev => [...prev, created])
      setNewSubtaskTitle('')
      useTaskStore.getState().loadSubtaskCounts()
    } catch {
      addToast('Failed to add subtask', 'error')
    } finally {
      setSubtaskLoading(false)
    }
  }

  const handleToggleSubtask = async (subtask: Subtask) => {
    try {
      const updated = await window.api.updateSubtask({ id: subtask.id, is_done: subtask.is_done ? 0 : 1 })
      setSubtasks(prev => prev.map(s => s.id === updated.id ? updated : s))
      useTaskStore.getState().loadSubtaskCounts()
    } catch {
      addToast('Failed to update subtask', 'error')
    }
  }

  const handleDeleteSubtask = async (id: string) => {
    try {
      await window.api.deleteSubtask(id)
      setSubtasks(prev => prev.filter(s => s.id !== id))
      useTaskStore.getState().loadSubtaskCounts()
    } catch {
      addToast('Failed to delete subtask', 'error')
    }
  }

  const handleMoveSubtask = async (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (isEditing) {
      const reordered = [...subtasks]
      ;[reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]]
      setSubtasks(reordered)
      try {
        await window.api.reorderSubtasks(reordered.map(s => s.id))
      } catch {
        addToast('Failed to reorder', 'error')
      }
    } else {
      const reordered = [...pendingSubtasks]
      ;[reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]]
      setPendingSubtasks(reordered)
    }
  }

  const handleApplyTemplate = (tmpl: TaskTemplate) => {
    setTitle(tmpl.title)
    if (tmpl.category_id) setCategoryId(tmpl.category_id)
    if (tmpl.notes) setNotes(tmpl.notes)
    if (tmpl.session_goal) setSessionGoal(tmpl.session_goal.toString())
    if (tmpl.subtasks) {
      try {
        const titles = JSON.parse(tmpl.subtasks) as string[]
        setPendingSubtasks(titles)
      } catch {}
    }
    setShowTemplateMenu(false)
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !title.trim()) return
    try {
      const subtaskTitles = isEditing ? subtasks.map(s => s.title) : pendingSubtasks
      const created = await window.api.createTaskTemplate({
        name: templateName.trim(),
        title: title.trim(),
        category_id: categoryId || undefined,
        notes: notes.trim() || undefined,
        session_goal: sessionGoal ? parseInt(sessionGoal, 10) : undefined,
        subtasks: subtaskTitles.length > 0 ? subtaskTitles : undefined,
      })
      setTemplates(prev => [created, ...prev])
      setTemplateName('')
      setShowSaveTemplate(false)
      addToast('Template saved')
    } catch {
      addToast('Failed to save template', 'error')
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      await window.api.deleteTaskTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch {
      addToast('Failed to delete template', 'error')
    }
  }

  const doneCount = subtasks.filter(s => s.is_done).length
  const canAddSubtask = newSubtaskTitle.trim().length > 0 && !subtaskLoading

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEditing ? 'Edit task' : 'New task'}
    >
      <div className="space-y-4">
        {/* Template bar */}
        {!isEditing && (
          <div className="flex items-center gap-2">
            {/* Load from template */}
            <div className="relative flex-1">
              <button
                onClick={() => setShowTemplateMenu(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all',
                  showTemplateMenu
                    ? 'text-[var(--accent)] bg-[var(--accent-bg)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                )}
              >
                <BookTemplate size={12} />
                From template
                <ChevronDown size={10} />
              </button>
              {showTemplateMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowTemplateMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-40 w-64 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-elevated py-1 animate-fade-in max-h-48 overflow-y-auto">
                    {templates.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-[var(--text-muted)]">No templates yet</p>
                    ) : templates.map(tmpl => (
                      <div key={tmpl.id} className="flex items-center group">
                        <button
                          onClick={() => handleApplyTemplate(tmpl)}
                          className="flex-1 text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <span className="font-medium">{tmpl.name}</span>
                          <span className="text-[var(--text-muted)] ml-1.5">{tmpl.title}</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tmpl.id) }}
                          className="h-6 w-6 mr-1 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

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

        {/* Subtasks */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Subtasks {isEditing && subtasks.length > 0 && (
              <span className="text-[var(--text-muted)]">({doneCount}/{subtasks.length} done)</span>
            )}
            {!isEditing && pendingSubtasks.length > 0 && (
              <span className="text-[var(--text-muted)]">({pendingSubtasks.length})</span>
            )}
          </label>

          {/* Subtask list — edit mode (persisted subtasks) */}
          {isEditing && subtasks.length > 0 && (
            <div className="space-y-1 mb-2">
              {subtasks.map((subtask, idx) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-1 group rounded px-2 py-1.5 hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <button
                    onClick={() => handleToggleSubtask(subtask)}
                    className={cn(
                      'flex-shrink-0 transition-colors',
                      subtask.is_done ? 'text-emerald-500' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    {subtask.is_done ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                  <span className={cn(
                    'flex-1 text-sm ml-1',
                    subtask.is_done
                      ? 'line-through text-[var(--text-muted)]'
                      : 'text-[var(--text-primary)]'
                  )}>
                    {subtask.title}
                  </span>
                  <div className="flex flex-col flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => handleMoveSubtask(idx, 'up')}
                      disabled={idx === 0}
                      className={cn('h-3.5 w-5 flex items-center justify-center rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors', idx === 0 && 'invisible')}
                    >
                      <ChevronUp size={10} />
                    </button>
                    <button
                      onClick={() => handleMoveSubtask(idx, 'down')}
                      disabled={idx === subtasks.length - 1}
                      className={cn('h-3.5 w-5 flex items-center justify-center rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors', idx === subtasks.length - 1 && 'invisible')}
                    >
                      <ChevronDown size={10} />
                    </button>
                  </div>
                  <button
                    onClick={() => handleDeleteSubtask(subtask.id)}
                    className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Subtask list — create mode (pending subtasks) */}
          {!isEditing && pendingSubtasks.length > 0 && (
            <div className="space-y-1 mb-2">
              {pendingSubtasks.map((title, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 group rounded px-2 py-1.5 hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <Square size={14} className="flex-shrink-0 text-[var(--text-muted)]" />
                  <span className="flex-1 text-sm text-[var(--text-primary)] ml-1">{title}</span>
                  <div className="flex flex-col flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => handleMoveSubtask(idx, 'up')}
                      disabled={idx === 0}
                      className={cn('h-3.5 w-5 flex items-center justify-center rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors', idx === 0 && 'invisible')}
                    >
                      <ChevronUp size={10} />
                    </button>
                    <button
                      onClick={() => handleMoveSubtask(idx, 'down')}
                      disabled={idx === pendingSubtasks.length - 1}
                      className={cn('h-3.5 w-5 flex items-center justify-center rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors', idx === pendingSubtasks.length - 1 && 'invisible')}
                    >
                      <ChevronDown size={10} />
                    </button>
                  </div>
                  <button
                    onClick={() => setPendingSubtasks(prev => prev.filter((_, i) => i !== idx))}
                    className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add subtask input */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  handleAddSubtask()
                } else {
                  const t = newSubtaskTitle.trim()
                  if (!t) return
                  setPendingSubtasks(prev => [...prev, t])
                  setNewSubtaskTitle('')
                }
              }}
              disabled={!newSubtaskTitle.trim() || subtaskLoading}
              className={cn(
                'flex-shrink-0 h-7 w-7 rounded flex items-center justify-center transition-colors',
                newSubtaskTitle.trim()
                  ? 'text-accent-400 hover:bg-[var(--accent-bg)] cursor-pointer'
                  : 'text-[var(--text-muted)] cursor-default'
              )}
              title="Add subtask"
            >
              <Plus size={14} />
            </button>
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  if (isEditing) {
                    handleAddSubtask()
                  } else {
                    const t = newSubtaskTitle.trim()
                    if (!t) return
                    setPendingSubtasks(prev => [...prev, t])
                    setNewSubtaskTitle('')
                  }
                }
              }}
              placeholder="Add subtask..."
              disabled={subtaskLoading}
              className="flex-1 h-8 px-2 text-sm bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border-b border-[var(--border)] focus:border-accent-500/40 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Category, Due Date, Session Goal row */}
        <div className="grid grid-cols-3 gap-3">
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
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent-500/40 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Session goal
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={sessionGoal}
              onChange={(e) => setSessionGoal(e.target.value)}
              placeholder="—"
              className="w-full h-9 px-3 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            />
          </div>
        </div>

        {/* Notes — at the bottom */}
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

        {/* Save as template */}
        {title.trim() && (
          <div>
            {showSaveTemplate ? (
              <div className="flex items-center gap-2 animate-fade-in">
                <BookTemplate size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTemplate(); if (e.key === 'Escape') setShowSaveTemplate(false) }}
                  placeholder="Template name..."
                  className="flex-1 h-7 px-2 text-xs rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
                />
                <Button size="sm" variant="accent" onClick={handleSaveTemplate} disabled={!templateName.trim()}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowSaveTemplate(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveTemplate(true)}
                className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <BookTemplate size={11} />
                Save as template
              </button>
            )}
          </div>
        )}

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
