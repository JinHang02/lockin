import { create } from 'zustand'
import { useToastStore } from './toast.store'
import type { Note, CreateNoteInput, UpdateNoteInput } from '../types'

interface NoteStore {
  notes: Note[]
  activeNoteId: string | null
  loading: boolean
  showArchived: boolean

  loadNotes: () => Promise<void>
  createNote: (input?: CreateNoteInput) => Promise<Note>
  updateNote: (input: UpdateNoteInput) => Promise<Note>
  deleteNote: (id: string) => Promise<void>
  setActiveNote: (id: string | null) => void
  toggleShowArchived: () => void
  archiveNote: (id: string) => Promise<void>
  unarchiveNote: (id: string) => Promise<void>
}

function showError(msg: string) {
  useToastStore.getState().addToast(msg, 'error')
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  activeNoteId: null,
  loading: false,
  showArchived: false,

  loadNotes: async () => {
    try {
      set({ loading: true })
      const notes = await window.api.getNotes()
      set({ notes, loading: false })
    } catch { set({ loading: false }) }
  },

  createNote: async (input) => {
    try {
      const note = await window.api.createNote(input ?? {})
      set((state) => ({ notes: [note, ...state.notes], activeNoteId: note.id }))
      return note
    } catch (e) {
      showError('Failed to create note')
      throw e
    }
  },

  updateNote: async (input) => {
    try {
      const updated = await window.api.updateNote(input)
      set((state) => ({
        notes: [updated, ...state.notes.filter((n) => n.id !== updated.id)]
      }))
      return updated
    } catch (e) {
      showError('Failed to update note')
      throw e
    }
  },

  deleteNote: async (id) => {
    const noteToDelete = get().notes.find((n) => n.id === id)
    try {
      await window.api.deleteNote(id)
      set((state) => {
        const remaining = state.notes.filter((n) => n.id !== id)
        return {
          notes: remaining,
          activeNoteId: state.activeNoteId === id
            ? (remaining.length > 0 ? remaining[0].id : null)
            : state.activeNoteId
        }
      })

      if (noteToDelete) {
        useToastStore.getState().addToast('Note deleted', 'success', async () => {
          try {
            const restored = await window.api.createNote({
              title: noteToDelete.title,
              content: noteToDelete.content,
              task_id: noteToDelete.task_id ?? undefined
            })
            set((state) => ({
              notes: [restored, ...state.notes],
              activeNoteId: restored.id
            }))
            useToastStore.getState().addToast('Note restored')
          } catch {
            showError('Failed to restore note')
          }
        })
      }
    } catch {
      showError('Failed to delete note')
    }
  },

  setActiveNote: (id) => set({ activeNoteId: id }),

  toggleShowArchived: () => set((state) => ({ showArchived: !state.showArchived })),

  archiveNote: async (id) => {
    try {
      const updated = await window.api.updateNote({ id, is_archived: 1 })
      set((state) => ({
        notes: state.notes.map((n) => n.id === updated.id ? updated : n),
        activeNoteId: state.activeNoteId === id ? null : state.activeNoteId,
      }))
      useToastStore.getState().addToast('Note archived', 'success', async () => {
        try {
          const restored = await window.api.updateNote({ id, is_archived: 0 })
          set((state) => ({
            notes: state.notes.map((n) => n.id === restored.id ? restored : n),
            activeNoteId: restored.id,
          }))
          useToastStore.getState().addToast('Note unarchived')
        } catch {
          showError('Failed to unarchive note')
        }
      })
    } catch {
      showError('Failed to archive note')
    }
  },

  unarchiveNote: async (id) => {
    try {
      const updated = await window.api.updateNote({ id, is_archived: 0 })
      set((state) => ({
        notes: state.notes.map((n) => n.id === updated.id ? updated : n),
      }))
      useToastStore.getState().addToast('Note unarchived')
    } catch {
      showError('Failed to unarchive note')
    }
  },
}))
