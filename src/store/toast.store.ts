import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  dismissing: boolean
  undoAction?: () => void
}

interface ToastStore {
  toasts: Toast[]
  addToast: (message: string, type?: Toast['type'], undoAction?: () => void) => string
  dismissToast: (id: string) => void
  removeToast: (id: string) => void
}

let nextId = 0

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (message, type = 'success', undoAction) => {
    const id = String(++nextId)
    const duration = undoAction ? 5000 : 3000
    set((state) => ({ toasts: [...state.toasts, { id, message, type, dismissing: false, undoAction }] }))
    setTimeout(() => {
      get().dismissToast(id)
    }, duration)
    return id
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.map((t) => t.id === id ? { ...t, dismissing: true } : t)
    }))
    // Remove after animation completes
    setTimeout(() => {
      get().removeToast(id)
    }, 200)
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))
