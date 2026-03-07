import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Flame, Filter, Sparkles } from 'lucide-react'
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
import { useToastStore } from '@/store/toast.store'
import Button from '@/components/ui/Button'
import CarryOverBanner from './CarryOverBanner'
import TaskCard from './TaskCard'
import TaskCardOverlay from './TaskCardOverlay'
import TaskForm from './TaskForm'
import { formatMinutes, cn, todayISO } from '@/lib/utils'
import type { Task } from '@/types'

type StatusFilter = 'all' | 'active' | 'blocked'

export default function TodayBoard() {
  const { tasks, reorderTasks, updateTask, createTask, todayStats, loadTodayStats, loadSessionCounts } = useTaskStore()
  const { isRunning, isPaused, startSession } = usePomodoroStore()
  const addToast = useToastStore((s) => s.addToast)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [quickAddValue, setQuickAddValue] = useState('')
  const [intention, setIntention] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const quickAddRef = useRef<HTMLInputElement>(null)
  const intentionSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isFocusing = isRunning || isPaused

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
  const doneTasks = tasks.filter((t) => t.status === 'done')
  const blockedCount = activeTasks.filter((t) => t.status === 'blocked').length

  const filteredActive = filter === 'all'
    ? activeTasks
    : filter === 'blocked'
      ? activeTasks.filter((t) => t.status === 'blocked')
      : activeTasks.filter((t) => t.status !== 'blocked')

  const activeTask = activeId ? activeTasks.find((t) => t.id === activeId) : null

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

      if (isInput) return

      // N: focus quick add
      if (e.key === 'n') {
        e.preventDefault()
        quickAddRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFocusing])

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

      {/* Content — dims during focus */}
      <div className={`flex-1 overflow-y-auto transition-opacity duration-300 ${isFocusing ? 'opacity-40 pointer-events-none select-none' : ''}`}>
        <div className="max-w-2xl mx-auto px-6 py-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">Today's Board</h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''} remaining
              </p>
            </div>
            <Button
              variant="accent"
              size="sm"
              onClick={() => { setEditingTask(null); setShowForm(true) }}
            >
              <Plus size={14} />
              Add task
            </Button>
          </div>

          {/* Morning intention */}
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={13} className="text-accent-400 flex-shrink-0" />
            <input
              type="text"
              value={intention}
              onChange={(e) => { setIntention(e.target.value); saveIntention(e.target.value) }}
              placeholder="What matters most today?"
              className="flex-1 text-sm bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border-b border-transparent focus:border-[var(--border)] focus:outline-none transition-colors italic"
            />
          </div>

          {/* Daily progress strip */}
          <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="flex items-center justify-between mb-2">
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
            <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
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

          {/* Status filter tabs */}
          {blockedCount > 0 && (
            <div className="flex items-center gap-1 mb-3">
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
                  {filteredActive.map((task) => (
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
          ) : (
            <div className="text-center py-16">
              <p className="text-[var(--text-muted)] text-sm">
                {filter !== 'all' ? 'No tasks match this filter.' : 'No tasks yet.'}
              </p>
              <p className="text-[var(--text-muted)] text-xs mt-1">
                {filter !== 'all' ? 'Try a different filter.' : 'Add a task to get started.'}
              </p>
            </div>
          )}

          {/* Quick inline add */}
          <div className="mt-3">
            <div className="flex items-center gap-2 group">
              <Plus size={14} className="text-[var(--text-muted)] flex-shrink-0" />
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
                placeholder="Quick add task... (press N)"
                className="flex-1 h-9 px-2 text-sm bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border-b border-transparent focus:border-[var(--border)] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Done tasks */}
          {doneTasks.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Completed ({doneTasks.length})
              </p>
              <div className="space-y-1.5">
                {doneTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={() => { setEditingTask(task); setShowForm(true) }}
                    onStartPomodoro={() => {}}
                    onStatusChange={(status) => updateTask({ id: task.id, status })}
                    done
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
    </div>
  )
}
