import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import {
  Plus, Trash2, FileText, Search, X, Pin, PinOff,
  ArrowUpDown, Maximize2, Minimize2, Clock, Type, CalendarPlus,
  Archive, ArchiveRestore, Eye, PenLine,
} from 'lucide-react'
import { useNoteStore } from '@/store/note.store'
import { useCodeMirror } from '@/components/journal/useCodeMirror'
import MarkdownToolbar from './MarkdownToolbar'
import MarkdownPreview from '@/components/ui/MarkdownPreview'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Note } from '@/types'

type SortBy = 'updated_at' | 'created_at' | 'title'

const SORT_OPTIONS: { value: SortBy; label: string; icon: React.ElementType }[] = [
  { value: 'updated_at', label: 'Last modified', icon: Clock },
  { value: 'created_at', label: 'Date created',  icon: CalendarPlus },
  { value: 'title',      label: 'Title',          icon: Type },
]

export default function NotesView() {
  const { notes, activeNoteId, loading, loadNotes, createNote, updateNote, deleteNote, setActiveNote, showArchived, toggleShowArchived, archiveNote, unarchiveNote } = useNoteStore()
  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null

  const [title, setTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [listWidth, setListWidth] = useState(() => {
    const saved = localStorage.getItem('notes_listWidth')
    return saved ? parseInt(saved, 10) : 260
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('updated_at')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [zenMode, setZenMode] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [contentStats, setContentStats] = useState({ words: 0, chars: 0 })

  const dragging = useRef(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeIdRef = useRef(activeNoteId)
  const prevActiveIdRef = useRef(activeNoteId)

  // Keep ref in sync for use in debounced save
  activeIdRef.current = activeNoteId

  const scheduleSave = useCallback((fields: { title?: string; content?: string }) => {
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const id = activeIdRef.current
      if (!id) return
      setSaveStatus('saving')
      try {
        await updateNote({ id, ...fields })
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
      }
    }, 800)
  }, [updateNote])

  const handleContentChange = useCallback((value: string) => {
    const words = value.trim() ? value.trim().split(/\s+/).length : 0
    setContentStats({ words, chars: value.length })
    scheduleSave({ content: value })
  }, [scheduleSave])

  const { setDoc, viewRef } = useCodeMirror(editorRef, {
    onChange: handleContentChange,
  })

  // Persist sidebar width
  useEffect(() => { localStorage.setItem('notes_listWidth', String(listWidth)) }, [listWidth])

  // Load notes on mount
  useEffect(() => { loadNotes() }, [])

  // When active note changes, update editor + title
  useEffect(() => {
    // Flush any pending save for the previous note before switching
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
      const prevId = prevActiveIdRef.current
      if (prevId && viewRef.current) {
        const content = viewRef.current.state.doc.toString()
        updateNote({ id: prevId, content }).catch(() => {})
      }
    }
    prevActiveIdRef.current = activeNoteId

    if (activeNote) {
      setTitle(activeNote.title)
      setDoc(activeNote.content)
      const words = activeNote.content.trim() ? activeNote.content.trim().split(/\s+/).length : 0
      setContentStats({ words, chars: activeNote.content.length })
      setSaveStatus('saved')
      setPreviewMode(false)
    } else {
      setTitle('')
      setDoc('')
      setContentStats({ words: 0, chars: 0 })
      setSaveStatus('saved')
      setPreviewMode(false)
    }
  }, [activeNoteId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape exits zen mode
      if (e.key === 'Escape' && zenMode) {
        e.preventDefault()
        setZenMode(false)
        return
      }
      // F11: toggle zen mode when editor is active
      if (e.key === 'F11' && activeNote) {
        e.preventDefault()
        setZenMode((v) => !v)
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zenMode, activeNote])

  const handleTitleChange = (v: string) => {
    setTitle(v)
    scheduleSave({ title: v })
  }

  const handleCreate = async () => {
    await createNote({ title: 'Untitled' })
  }

  const handleTogglePin = async (note: Note) => {
    await updateNote({ id: note.id, is_pinned: note.is_pinned ? 0 : 1 })
  }

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const startX = e.clientX
    const startWidth = listWidth

    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const newWidth = Math.max(180, Math.min(480, startWidth + (e.clientX - startX)))
      setListWidth(newWidth)
    }

    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [listWidth])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Filter + sort notes
  const displayedNotes = useMemo(() => {
    let filtered = notes.filter((n) => showArchived ? n.is_archived : !n.is_archived)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      )
    }

    // Separate pinned / unpinned
    const pinned = filtered.filter((n) => n.is_pinned)
    const unpinned = filtered.filter((n) => !n.is_pinned)

    const sortFn = (a: Note, b: Note): number => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
        case 'created_at':
          return b.created_at.localeCompare(a.created_at)
        case 'updated_at':
        default:
          return b.updated_at.localeCompare(a.updated_at)
      }
    }

    pinned.sort(sortFn)
    unpinned.sort(sortFn)

    return { pinned, unpinned, all: [...pinned, ...unpinned] }
  }, [notes, searchQuery, sortBy, showArchived])

  const readingTime = Math.max(1, Math.round(contentStats.words / 200))

  // ── Highlight matching text ───────────────────────────────────────────────
  const highlightMatch = (text: string, maxLen?: number) => {
    const display = maxLen ? text.slice(0, maxLen) : text
    if (!searchQuery.trim()) return display
    const q = searchQuery.trim()
    const idx = display.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return display
    return (
      <>
        {display.slice(0, idx)}
        <mark className="bg-[var(--accent-bg)] text-[var(--accent)] rounded-sm px-0.5">{display.slice(idx, idx + q.length)}</mark>
        {display.slice(idx + q.length)}
      </>
    )
  }

  // ── Note list item ────────────────────────────────────────────────────────
  const renderNoteItem = (note: Note) => (
    <div key={note.id} className="relative group">
      <button
        onClick={() => setActiveNote(note.id)}
        className={cn(
          'w-full text-left px-3 py-2.5 rounded-lg transition-all duration-100',
          activeNoteId === note.id
            ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
        )}
      >
        <div className="flex items-center gap-1.5">
          {note.is_pinned ? (
            <Pin size={10} className="text-accent-400 flex-shrink-0" />
          ) : null}
          <p className="text-sm font-medium truncate flex-1">
            {highlightMatch(note.title || 'Untitled')}
          </p>
        </div>
        <p className={cn(
          'text-xs truncate mt-0.5',
          activeNoteId === note.id ? 'text-[var(--accent)]/60' : 'text-[var(--text-muted)]'
        )}>
          {highlightMatch(note.content.split('\n')[0] || 'Empty note', 60)}
        </p>
        <p className={cn(
          'text-[10px] mt-1',
          activeNoteId === note.id ? 'text-[var(--accent)]/50' : 'text-[var(--text-muted)]'
        )}>
          {formatDate(note.updated_at)}
        </p>
      </button>

      {/* Hover actions: pin + delete */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {confirmDeleteId === note.id ? (
          <div className="flex items-center gap-1 animate-fade-in">
            <button
              onClick={(e) => { e.stopPropagation(); deleteNote(note.id); setConfirmDeleteId(null) }}
              className="h-6 px-2 rounded text-[10px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
              className="h-6 px-2 rounded text-[10px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            {showArchived ? (
              <button
                onClick={(e) => { e.stopPropagation(); unarchiveNote(note.id) }}
                className="h-6 w-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-accent-400 hover:bg-[var(--accent-bg)] transition-colors"
                title="Unarchive"
              >
                <ArchiveRestore size={11} />
              </button>
            ) : (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleTogglePin(note) }}
                  className={cn(
                    'h-6 w-6 rounded flex items-center justify-center transition-colors',
                    note.is_pinned
                      ? 'text-accent-400 hover:text-accent-300 hover:bg-[var(--accent-bg)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                  )}
                  title={note.is_pinned ? 'Unpin' : 'Pin'}
                >
                  {note.is_pinned ? <PinOff size={11} /> : <Pin size={11} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); archiveNote(note.id) }}
                  className="h-6 w-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                  title="Archive note"
                >
                  <Archive size={11} />
                </button>
              </>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(note.id) }}
              className="h-6 w-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete note"
            >
              <Trash2 size={11} />
            </button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="h-full flex overflow-hidden">
      {/* Note list sidebar */}
      <div className="flex-shrink-0 border-r border-[var(--border)] flex flex-col bg-[var(--bg-surface)]" style={{ width: listWidth }}>
        {/* List header */}
        <div className="flex items-center justify-between px-3 h-14 border-b border-[var(--border)] flex-shrink-0">
          <h2 className="text-sm font-display font-semibold text-[var(--text-primary)] flex-shrink-0">
            {showArchived ? 'Archived' : 'Notes'}
          </h2>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => { setShowSearch((v) => !v); setTimeout(() => searchInputRef.current?.focus(), 50) }}
              className={cn(
                'h-7 w-7 rounded flex items-center justify-center transition-colors focus-ring',
                showSearch
                  ? 'text-[var(--accent)] bg-[var(--accent-bg)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              )}
              title="Search notes"
            >
              <Search size={14} />
            </button>

            {/* Sort menu */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu((v) => !v)}
                className={cn(
                  'h-7 w-7 rounded flex items-center justify-center transition-colors focus-ring',
                  showSortMenu
                    ? 'text-[var(--accent)] bg-[var(--accent-bg)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                )}
                title="Sort notes"
              >
                <ArrowUpDown size={14} />
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-40 w-44 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-elevated py-1 animate-fade-in">
                    {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => { setSortBy(value); setShowSortMenu(false) }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors',
                          sortBy === value
                            ? 'text-[var(--accent)] bg-[var(--accent-bg)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                        )}
                      >
                        <Icon size={13} />
                        <span className="font-medium">{label}</span>
                        {sortBy === value && (
                          <span className="ml-auto text-[var(--accent)]">&#10003;</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={toggleShowArchived}
              className={cn(
                'h-7 w-7 rounded flex items-center justify-center transition-colors focus-ring',
                showArchived
                  ? 'text-[var(--accent)] bg-[var(--accent-bg)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              )}
              title={showArchived ? 'Show active notes' : 'Show archived notes'}
            >
              <Archive size={14} />
            </button>

            <Button variant="ghost" size="icon" onClick={handleCreate} title="New note">
              <Plus size={16} />
            </Button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-elevated)] animate-fade-in">
            <Search size={13} className="text-[var(--text-muted)] flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="flex-1 text-xs bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setSearchQuery(''); setShowSearch(false) }
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="h-5 w-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Note items */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {loading && notes.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-8">Loading...</p>
          ) : displayedNotes.all.length === 0 ? (
            searchQuery ? (
              <div className="text-center py-8 px-4">
                <p className="text-xs text-[var(--text-muted)]">No notes match "{searchQuery}"</p>
              </div>
            ) : (
              <div className="text-center py-12 px-4">
                <FileText size={24} className="mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-sm text-[var(--text-muted)]">No notes yet</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Create one to get started</p>
              </div>
            )
          ) : (
            <>
              {/* Pinned section */}
              {displayedNotes.pinned.length > 0 && (
                <>
                  <p className="text-2xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-3 pt-1 pb-0.5 flex items-center gap-1.5">
                    <Pin size={9} />
                    Pinned
                  </p>
                  {displayedNotes.pinned.map(renderNoteItem)}
                  {displayedNotes.unpinned.length > 0 && (
                    <div className="h-px bg-[var(--border)] mx-3 my-2" />
                  )}
                </>
              )}
              {/* Unpinned */}
              {displayedNotes.unpinned.map(renderNoteItem)}
            </>
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="w-1 flex-shrink-0 cursor-col-resize hover:bg-accent-500/30 active:bg-accent-500/40 transition-colors"
      />

      {/* Editor panel — single instance, toggles between inline and fixed for zen */}
      <div className={cn(
        'flex flex-col overflow-hidden bg-[var(--bg-base)]',
        zenMode && activeNote
          ? 'fixed inset-0 z-50'
          : 'flex-1'
      )}>
        {activeNote ? (
          <>
            {/* Title input */}
            <div className={cn(
              'flex-shrink-0 border-b border-[var(--border)]',
              zenMode ? 'px-8 py-6' : 'px-6 py-4'
            )}>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Note title..."
                  className={cn(
                    'flex-1 font-semibold bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none',
                    zenMode ? 'text-2xl' : 'text-lg'
                  )}
                />
                <button
                  onClick={() => {
                    const entering = !previewMode
                    setPreviewMode(entering)
                    if (!entering && activeNote) setDoc(activeNote.content)
                  }}
                  className={cn(
                    'h-7 w-7 rounded flex items-center justify-center transition-colors focus-ring flex-shrink-0',
                    previewMode
                      ? 'text-[var(--accent)] bg-[var(--accent-bg)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                  )}
                  title={previewMode ? 'Edit mode' : 'Preview markdown'}
                >
                  {previewMode ? <PenLine size={14} /> : <Eye size={14} />}
                </button>
                <button
                  onClick={() => setZenMode(!zenMode)}
                  className="h-7 w-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors focus-ring flex-shrink-0"
                  title={zenMode ? 'Exit zen mode (Esc)' : 'Zen mode (F11)'}
                >
                  {zenMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
            </div>

            {/* Markdown toolbar — only in edit mode */}
            {!previewMode && (
              <div className="flex-shrink-0 border-b border-[var(--border)]">
                <MarkdownToolbar viewRef={viewRef} />
              </div>
            )}

            {/* Editor / Preview */}
            <div className="flex-1 overflow-y-auto">
              <div className={cn(
                'mx-auto',
                zenMode ? 'max-w-2xl px-8 py-6' : 'max-w-3xl px-6 py-4'
              )}>
                {previewMode ? (
                  <div className={cn(
                    'rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4',
                    zenMode ? 'min-h-[60vh]' : 'min-h-[400px]'
                  )}>
                    {activeNote?.content ? (
                      <MarkdownPreview content={activeNote.content} />
                    ) : (
                      <p className="text-sm text-[var(--text-muted)] italic">Nothing to preview</p>
                    )}
                  </div>
                ) : (
                  <div
                    ref={editorRef}
                    className={cn(
                      'rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 shadow-sm focus-within:ring-2 focus-within:ring-accent-500/30 focus-within:border-accent-500/40',
                      zenMode ? 'min-h-[60vh]' : 'min-h-[400px]'
                    )}
                  />
                )}
              </div>
            </div>

            {/* Status bar */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-3">
                <span>{contentStats.words} word{contentStats.words !== 1 ? 's' : ''}</span>
                <span className="w-px h-3 bg-[var(--border)]" />
                <span>{contentStats.chars} char{contentStats.chars !== 1 ? 's' : ''}</span>
                <span className="w-px h-3 bg-[var(--border)]" />
                <span>~{readingTime} min read</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  saveStatus === 'saved' ? 'bg-emerald-500' :
                  saveStatus === 'saving' ? 'bg-amber-400' : 'bg-[var(--text-muted)]'
                )} />
                <span>{saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText size={32} className="mx-auto text-[var(--text-muted)] mb-3" />
              <p className="text-sm text-[var(--text-muted)]">
                {notes.length === 0 ? 'Create a note to get started' : 'Select a note to edit'}
              </p>
              {notes.length === 0 && (
                <Button variant="accent" size="sm" className="mt-3" onClick={handleCreate}>
                  <Plus size={14} />
                  New note
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
