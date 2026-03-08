import { create } from 'zustand'
import { useToastStore } from './toast.store'
import type { Task, Category, CreateTaskInput, UpdateTaskInput } from '../types'

interface TodayStats {
  session_count: number
  total_minutes: number
}

interface TaskStore {
  tasks: Task[]
  categories: Category[]
  carryoverTasks: Task[]
  carryoverResolved: boolean
  loading: boolean
  sessionCounts: Record<string, number>
  todayStats: TodayStats
  streak: number
  selectedIds: Set<string>
  selectionMode: boolean

  loadTasks: () => Promise<void>
  loadCategories: () => Promise<void>
  checkCarryover: () => Promise<void>
  loadSessionCounts: () => Promise<void>
  loadTodayStats: () => Promise<void>
  loadStreak: () => Promise<void>
  createTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (input: UpdateTaskInput) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  reorderTasks: (ids: string[]) => Promise<void>
  resolveCarry: (id: string, action: 'keep' | 'drop') => Promise<void>
  createCategory: (label: string, color: string) => Promise<Category>
  updateCategory: (id: string, label?: string, color?: string) => Promise<Category>
  deleteCategory: (id: string) => Promise<void>
  toggleSelection: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  setSelectionMode: (mode: boolean) => void
  bulkUpdateStatus: (status: Task['status']) => Promise<void>
  bulkDelete: () => Promise<void>
}

function showError(msg: string) {
  useToastStore.getState().addToast(msg, 'error')
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  categories: [],
  carryoverTasks: [],
  carryoverResolved: false,
  loading: false,
  sessionCounts: {},
  todayStats: { session_count: 0, total_minutes: 0 },
  streak: 0,
  selectedIds: new Set<string>(),
  selectionMode: false,

  loadTasks: async () => {
    try {
      set({ loading: true })
      const tasks = await window.api.getTodayTasks()
      set({ tasks, loading: false })
    } catch { set({ loading: false }) }
  },

  loadCategories: async () => {
    try {
      const categories = await window.api.getCategories()
      set({ categories })
    } catch (e) { console.warn('Failed to load categories:', e) }
  },

  checkCarryover: async () => {
    try {
      const carryoverTasks = await window.api.getCarryoverTasks()
      set({ carryoverTasks, carryoverResolved: carryoverTasks.length === 0 })
    } catch (e) { console.warn('Failed to check carryover:', e) }
  },

  loadSessionCounts: async () => {
    try {
      const sessionCounts = await window.api.getSessionCountsByTask()
      set({ sessionCounts })
    } catch (e) { console.warn('Failed to load session counts:', e) }
  },

  loadTodayStats: async () => {
    try {
      const todayStats = await window.api.getTodayStats()
      set({ todayStats })
    } catch (e) { console.warn('Failed to load today stats:', e) }
  },

  loadStreak: async () => {
    try {
      const streak = await window.api.getStreak()
      set({ streak })
    } catch (e) { console.warn('Failed to load streak:', e) }
  },

  createTask: async (input) => {
    try {
      const task = await window.api.createTask(input)
      set((state) => ({ tasks: [...state.tasks, task] }))
      return task
    } catch (e) {
      showError('Failed to create task')
      throw e
    }
  },

  updateTask: async (input) => {
    try {
      const updated = await window.api.updateTask(input)
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === updated.id ? updated : t))
      }))
      return updated
    } catch (e) {
      showError('Failed to update task')
      throw e
    }
  },

  deleteTask: async (id) => {
    // Snapshot the task before deleting for undo
    const taskToDelete = get().tasks.find((t) => t.id === id)
    try {
      await window.api.deleteTask(id)
      set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }))

      // Offer undo — re-create the task with same data
      if (taskToDelete) {
        useToastStore.getState().addToast('Task deleted', 'success', async () => {
          try {
            const restored = await window.api.createTask({
              title: taskToDelete.title,
              notes: taskToDelete.notes ?? undefined,
              category_id: taskToDelete.category_id ?? undefined
            })
            set((state) => ({ tasks: [...state.tasks, restored] }))
            useToastStore.getState().addToast('Task restored')
          } catch {
            showError('Failed to restore task')
          }
        })
      }
    } catch {
      showError('Failed to delete task')
    }
  },

  reorderTasks: async (ids) => {
    // Optimistic update — reorder active tasks while preserving done tasks
    set((state) => {
      const reorderedIds = new Set(ids)
      const taskMap = new Map(state.tasks.map((t) => [t.id, t]))
      const reordered = ids
        .map((id, idx) => {
          const t = taskMap.get(id)
          return t ? { ...t, priority: idx } : null
        })
        .filter(Boolean) as Task[]
      const preserved = state.tasks.filter((t) => !reorderedIds.has(t.id))
      return { tasks: [...reordered, ...preserved] }
    })
    try {
      await window.api.reorderTasks(ids)
    } catch {
      showError('Failed to reorder tasks')
      await get().loadTasks()
    }
  },

  resolveCarry: async (id, action) => {
    const taskToDrop = action === 'drop' ? get().carryoverTasks.find((t) => t.id === id) : null
    try {
      await window.api.resolveCarry(id, action)
      set((state) => {
        const remaining = state.carryoverTasks.filter((t) => t.id !== id)
        return {
          carryoverTasks: remaining,
          carryoverResolved: remaining.length === 0
        }
      })
      if (action === 'keep') {
        await get().loadTasks()
      }
      // Offer undo for dropped tasks
      if (action === 'drop' && taskToDrop) {
        useToastStore.getState().addToast('Task dropped', 'success', async () => {
          try {
            const restored = await window.api.createTask({
              title: taskToDrop.title,
              notes: taskToDrop.notes ?? undefined,
              category_id: taskToDrop.category_id ?? undefined
            })
            set((state) => ({ tasks: [...state.tasks, restored] }))
            useToastStore.getState().addToast('Task restored')
          } catch {
            showError('Failed to restore task')
          }
        })
      }
    } catch {
      showError('Failed to resolve carry-over')
    }
  },

  createCategory: async (label, color) => {
    try {
      const cat = await window.api.createCategory({ label, color })
      set((state) => ({ categories: [...state.categories, cat] }))
      return cat
    } catch (e) {
      showError('Failed to create category')
      throw e
    }
  },

  updateCategory: async (id, label, color) => {
    try {
      const updated = await window.api.updateCategory({ id, label, color })
      set((state) => ({
        categories: state.categories.map((c) => (c.id === id ? updated : c))
      }))
      // Refresh tasks to update denormalized category_label/category_color
      get().loadTasks()
      return updated
    } catch (e) {
      showError('Failed to update category')
      throw e
    }
  },

  deleteCategory: async (id) => {
    try {
      await window.api.deleteCategory(id)
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id)
      }))
      // Refresh tasks to clear denormalized category fields
      get().loadTasks()
    } catch {
      showError('Failed to delete category')
    }
  },

  toggleSelection: (id) => {
    set((state) => {
      const next = new Set(state.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedIds: next, selectionMode: next.size > 0 }
    })
  },

  selectAll: (ids) => {
    set({ selectedIds: new Set(ids), selectionMode: ids.length > 0 })
  },

  clearSelection: () => {
    set({ selectedIds: new Set(), selectionMode: false })
  },

  setSelectionMode: (mode) => {
    set({ selectionMode: mode, selectedIds: mode ? get().selectedIds : new Set() })
  },

  bulkUpdateStatus: async (status) => {
    const ids = Array.from(get().selectedIds)
    if (!ids.length) return
    try {
      await window.api.bulkUpdateTasks(ids, status)
      await get().loadTasks()
      get().clearSelection()
      useToastStore.getState().addToast(`${ids.length} task${ids.length > 1 ? 's' : ''} updated`)
    } catch {
      showError('Failed to update tasks')
    }
  },

  bulkDelete: async () => {
    const ids = Array.from(get().selectedIds)
    if (!ids.length) return
    try {
      await window.api.bulkDeleteTasks(ids)
      set((state) => ({
        tasks: state.tasks.filter((t) => !ids.includes(t.id))
      }))
      get().clearSelection()
      useToastStore.getState().addToast(`${ids.length} task${ids.length > 1 ? 's' : ''} deleted`)
    } catch {
      showError('Failed to delete tasks')
    }
  },
}))
