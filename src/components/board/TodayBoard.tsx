import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Flame, Filter, Sparkles, CheckCircle2, CircleDot, ListChecks, Trash2, X, History } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { useTaskStore } from '@/store/task.store'
import { usePomodoroStore } from '@/store/pomodoro.store'
import { useAppStore } from '@/store/app.store'
import { useToastStore } from '@/store/toast.store'
import Button from '@/components/ui/Button'
import CarryOverBanner from './CarryOverBanner'
import TaskCard from './TaskCard'
import TaskCardOverlay from './TaskCardOverlay'
import TaskForm from './TaskForm'
import HistoryPanel from './HistoryPanel'
import { formatMinutes, cn, todayISO } from '@/lib/utils'
import type { Task } from '@/types'

type StatusFilter = 'all' | 'active' | 'blocked'

export default function TodayBoard() {
  const {
    tasks, categories, reorderTasks, updateTask, createTask,
    todayStats, loadTodayStats, loadSessionCounts,
    selectedIds, selectionMode, toggleSelection, selectAll, clearSelection,
    bulkUpdateStatus, bulkDelete,
  } = useTaskStore()
  const { isRunning, isPaused, startSession } = usePomodoroStore()
  const focusMode = useAppStore((s) => s.settings?.focus_mode ?? 'dim')
  const addToast = useToastStore((s) => s.addToast)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [quickAddValue, setQuickAddValue] = useState('')
  const [intention, setIntention] = useState('')
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState<number>(-1)
  const quickAddRef = useRef<HTMLInputElement>(null)
  const intentionSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isFocusing = (isRunning || isPaused) && focusMode !== 'off'

  // Load today's intention
  useEffect(() => {
    window.api.getJournalByDate(todayISO()).then((entry) => {
      setIntention(entry?.intention ?? '')
    }).catch(() => {})
  }, [])

  const saveIntention = useCallback((value: string) => {
    if (intentionSaveRef.current) clearTimeout(intentionSaveRef.current)
    intentionSaveRef.current = setTimeout(() => {
      window.api.upsertJournal({ date: todayISO(), intention: value }).catch(() => {})
    }, 800)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const activeTasks = tasks.filter((t) => t.status !== 'done')
  let doneTasks = tasks.filter((t) => t.status === 'done')
  const blockedCount = activeTasks.filter((t) => t.status === 'blocked').length

  // Apply status filter
  let filteredActive = filter === 'all'
    ? activeTasks
    : filter === 'blocked'
      ? activeTasks.filter((t) => t.status === 'blocked')
      : activeTasks.filter((t) => t.status !== 'blocked')

  // Apply category filter
  if (categoryFilter) {
    filteredActive = filteredActive.filter((t) => t.category_id === categoryFilter)
    doneTasks = doneTasks.filter((t) => t.category_id === categoryFilter)
  }

  // Sort overdue tasks to the top, then due today, then the rest
  const todayStr = todayISO()
  filteredActive = [...filteredActive].sort((a, b) => {
    const aOverdue = a.due_date && a.due_date < todayStr ? -2 : a.due_date === todayStr ? -1 : 0
    const bOverdue = b.due_date && b.due_date < todayStr ? -2 : b.due_date === todayStr ? -1 : 0
    return aOverdue - bOverdue
  })

  // Unique categories from tasks
  const taskCategories = categories.filter(c =>
    tasks.some(t => t.category_id === c.id)
  )

  const activeTask = activeId ? activeTasks.find((t) => t.id === activeId) : null

  // Reset focused index when filters change
  useEffect(() => { setFocusedIdx(-1) }, [filter, categoryFilter])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFocusing) return
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable

      // Ctrl+N: open full task form
      if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setEditingTask(null)
        setShowForm(true)
        return
      }

      // Escape: clear selection or clear focus
      if (e.key === 'Escape') {
        if (selectionMode) {
          e.preventDefault()
          clearSelection()
          setConfirmBulkDelete(false)
          return
        }
        if (focusedIdx >= 0) {
          e.preventDefault()
          setFocusedIdx(-1)
          return
        }
      }

      if (isInput) return

      // N: focus quick add
      if (e.key === 'n') {
        e.preventDefault()
        quickAddRef.current?.focus()
        return
      }

      // Arrow key navigation
      const allTasks = [...filteredActive, ...doneTasks]
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setFocusedIdx(prev => Math.min(prev + 1, allTasks.length - 1))
        return
      }
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setFocusedIdx(prev => Math.max(prev - 1, 0))
        return
      }

      // Actions on focused task
      if (focusedIdx >= 0 && focusedIdx < allTasks.length) {
        const focusedTask = allTasks[focusedIdx]

        // Enter or E: edit
        if (e.key === 'Enter' || e.key === 'e') {
          e.preventDefault()
          setEditingTask(focusedTask)
          setShowForm(true)
          return
        }

        // D: toggle done/todo
        if (e.key === 'd') {
          e.preventDefault()
          updateTask({ id: focusedTask.id, status: focusedTask.status === 'done' ? 'todo' : 'done' })
          return
        }

        // P: start pomodoro (only for non-done tasks)
        if (e.key === 'p' && focusedTask.status !== 'done') {
          e.preventDefault()
          startSession(focusedTask)
          loadTodayStats()
          loadSessionCounts()
          return
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFocusing, selectionMode, clearSelection, focusedIdx, filteredActive, doneTasks, updateTask, startSession, loadTodayStats, loadSessionCounts])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = activeTasks.findIndex((t) => t.id === active.id)
    const newIndex = activeTasks.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(activeTasks, oldIndex, newIndex)
    await reorderTasks(reordered.map((t) => t.id))
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const handleQuickAdd = async () => {
    const title = quickAddValue.trim()
    if (!title) return
    await createTask({ title })
    setQuickAddValue('')
    addToast('Task created')
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Carry-over banner */}
      <CarryOverBanner />

      {/* Bulk action bar */}
      {selectionMode && (
        <div className="flex-shrink-0 flex items-center gap-2 px-6 py-2 border-b border-[var(--border)] bg-[var(--accent-bg)] animate-fade-in">
          <span className="text-xs font-medium text-[var(--accent)]">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => selectAll(filteredActive.map(t => t.id))}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-elevated)]"
          >
            Select all
          </button>
          <Button size="sm" variant="ghost" onClick={() => bulkUpdateStatus('done')}>
            <CheckCircle2 size={12} />
            Complete
          </Button>
          {confirmBulkDelete ? (
            <>
              <span className="text-xs text-red-400 font-medium">Delete {selectedIds.size} task{selectedIds.size !== 1 ? 's' : ''}?</span>
              <Button size="sm" variant="destructive" onClick={() => { bulkDelete(); setConfirmBulkDelete(false) }}>
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmBulkDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => setConfirmBulkDelete(true)}>
              <Trash2 size={12} />
              Delete
            </Button>
          )}
          <button
            onClick={clearSelection}
            className="h-6 w-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Content — dims during focus */}
      <div className={`flex-1 overflow-y-auto transition-opacity duration-300 ${isFocusing ? 'opacity-40 pointer-events-none select-none' : ''}`}>
        <div className="max-w-2xl mx-auto px-6 py-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-display font-semibold text-[var(--text-primary)]">Today's Board</h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''} remaining
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(true)}
                title="Completed history"
              >
                <History size={14} />
              </Button>
              {!selectionMode && activeTasks.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => useTaskStore.getState().setSelectionMode(true)}
                  title="Select multiple tasks"
                >
                  <ListChecks size={14} />
                </Button>
              )}
              <Button
                variant="accent"
                size="sm"
                onClick={() => { setEditingTask(null); setShowForm(true) }}
              >
                <Plus size={14} />
                Add task
              </Button>
            </div>
          </div>

          {/* Daily progress strip */}
          <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-accent-400" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Today's Focus
                </span>
              </div>
              <span className="text-xs text-[var(--text-secondary)]">
                {todayStats.session_count} session{todayStats.session_count !== 1 ? 's' : ''} · {formatMinutes(todayStats.total_minutes)} focused
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={12} className="text-accent-400 flex-shrink-0" />
              <input
                type="text"
                value={intention}
                onChange={(e) => { setIntention(e.target.value); saveIntention(e.target.value) }}
                placeholder="What matters most today?"
                className="flex-1 text-xs bg-transparent text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:text-[var(--text-primary)] border-b border-transparent focus:border-[var(--border)] focus:outline-none transition-colors italic"
              />
            </div>
            <div className="h-2.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-400 transition-all duration-500"
                style={{ width: `${Math.min(100, (todayStats.total_minutes / (8 * 25)) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[var(--text-muted)]">0h</span>
              <span className="text-[10px] text-[var(--text-muted)]">
                {doneTasks.length} completed
              </span>
            </div>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {/* Status filter tabs */}
            {blockedCount > 0 && (
              <div className="flex items-center gap-1">
                <Filter size={12} className="text-[var(--text-muted)] mr-1" />
                {([
                  { key: 'all' as const, label: 'All', count: activeTasks.length },
                  { key: 'active' as const, label: 'Active', count: activeTasks.length - blockedCount },
                  { key: 'blocked' as const, label: 'Blocked', count: blockedCount },
                ]).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs font-medium transition-all duration-100',
                      filter === key
                        ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    {label}
                    {count > 0 && (
                      <span className={cn(
                        'ml-1.5 tabular-nums',
                        filter === key ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Category filter */}
            {taskCategories.length > 0 && (
              <div className="flex items-center gap-1">
                {blockedCount > 0 && <div className="w-px h-4 bg-[var(--border)] mx-1" />}
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={cn(
                    'px-2 py-1 rounded text-xs font-medium transition-all duration-100',
                    categoryFilter === null
                      ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                  )}
                >
                  All
                </button>
                {taskCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all duration-100',
                      categoryFilter === cat.id
                        ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ongoing section */}
          <div>
            <p className="text-xs font-medium text-amber-500/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CircleDot size={12} />
              Ongoing ({filteredActive.length})
            </p>

            {/* Quick inline add — only when no ongoing tasks */}
            {filteredActive.length === 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-2 group">
                  <button
                    onClick={() => { if (quickAddValue.trim()) handleQuickAdd(); else quickAddRef.current?.focus() }}
                    className="text-[var(--text-muted)] hover:text-[var(--accent)] flex-shrink-0 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                  <input
                    ref={quickAddRef}
                    value={quickAddValue}
                    onChange={(e) => setQuickAddValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuickAdd()
                      if (e.key === 'Escape') {
                        setQuickAddValue('')
                        ;(e.target as HTMLElement).blur()
                      }
                    }}
                    placeholder="Quick add task..."
                    className="flex-1 h-9 px-2 text-sm bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border-b border-transparent focus:border-[var(--border)] focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Active tasks with drag-and-drop */}
            {filteredActive.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              >
                <SortableContext items={filteredActive.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {filteredActive.map((task, idx) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={() => { setEditingTask(task); setShowForm(true) }}
                        onStartPomodoro={() => {
                          startSession(task)
                          loadTodayStats()
                          loadSessionCounts()
                        }}
                        onStatusChange={(status) => updateTask({ id: task.id, status })}
                        isDragOverlay={false}
                        selectionMode={selectionMode}
                        selected={selectedIds.has(task.id)}
                        onToggleSelect={() => toggleSelection(task.id)}
                        focused={focusedIdx === idx}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay dropAnimation={{
                  duration: 200,
                  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                }}>
                  {activeTask ? (
                    <TaskCardOverlay task={activeTask} />
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : tasks.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-[var(--text-muted)] text-sm">
                  {filter !== 'all' || categoryFilter ? 'No tasks match this filter.' : 'No tasks yet. Add a task to get started.'}
                </p>
              </div>
            ) : null}
          </div>

          {/* Completed tasks */}
          {doneTasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <p className="text-xs font-medium text-emerald-500/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={12} />
                Completed ({doneTasks.length})
              </p>
              <div className="space-y-2">
                {doneTasks.map((task, idx) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={() => { setEditingTask(task); setShowForm(true) }}
                    onStartPomodoro={() => {}}
                    onStatusChange={(status) => updateTask({ id: task.id, status })}
                    done
                    selectionMode={selectionMode}
                    selected={selectedIds.has(task.id)}
                    onToggleSelect={() => toggleSelection(task.id)}
                    focused={focusedIdx === filteredActive.length + idx}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Task form modal */}
      {showForm && (
        <TaskForm
          task={editingTask}
          onClose={() => { setShowForm(false); setEditingTask(null) }}
        />
      )}

      {/* History panel */}
      {showHistory && (
        <HistoryPanel onClose={() => setShowHistory(false)} />
      )}
    </div>
  )
}
