import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Search, FileText, BookOpen, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchResult, SearchResults } from '@/types'

interface SearchPaletteProps {
  onClose: () => void
  onNavigateToTask: (taskId: string) => void
  onNavigateToJournal: (date: string) => void
}

export default function SearchPalette({
  onClose,
  onNavigateToTask,
  onNavigateToJournal
}: SearchPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({ tasks: [], journals: [] })
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Flat list of all results for keyboard navigation
  const flatResults = useMemo<SearchResult[]>(
    () => [...results.tasks, ...results.journals],
    [results]
  )

  // Focus the input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    const trimmed = query.trim()
    if (!trimmed) {
      setResults({ tasks: [], journals: [] })
      setActiveIndex(0)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await window.api.searchTasks(trimmed)
        setResults(data)
        setActiveIndex(0)
      } catch {
        setResults({ tasks: [], journals: [] })
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query])

  // Select the active result
  const selectResult = useCallback(
    (result: SearchResult) => {
      if (result.type === 'task') {
        onNavigateToTask(result.id)
      } else {
        onNavigateToJournal(result.date ?? '')
      }
      onClose()
    },
    [onNavigateToTask, onNavigateToJournal, onClose]
  )

  // Scroll the active item into view
  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector('[data-active="true"]')
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((prev) =>
            flatResults.length === 0 ? 0 : (prev + 1) % flatResults.length
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((prev) =>
            flatResults.length === 0
              ? 0
              : (prev - 1 + flatResults.length) % flatResults.length
          )
          break
        case 'Enter':
          e.preventDefault()
          if (flatResults[activeIndex]) {
            selectResult(flatResults[activeIndex])
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [flatResults, activeIndex, selectResult, onClose])

  const hasResults = flatResults.length > 0
  const showEmpty = query.trim().length > 0 && !isLoading && !hasResults

  // Track the running index across both groups for keyboard navigation
  let runningIndex = 0

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-label="Search"
      aria-modal="true"
    >
      <div
        className={cn(
          'w-full max-w-lg rounded-xl shadow-elevated animate-slide-down',
          'bg-[var(--bg-surface)] border border-[var(--border)]',
          'flex flex-col overflow-hidden'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-[var(--border)]">
          <Search
            size={18}
            className="shrink-0 text-[var(--text-muted)]"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks and journal entries..."
            className={cn(
              'flex-1 h-12 bg-transparent text-sm text-[var(--text-primary)]',
              'placeholder:text-[var(--text-muted)] outline-none'
            )}
            spellCheck={false}
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="shrink-0 h-6 w-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto"
        >
          {/* Task results */}
          {results.tasks.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Tasks
              </p>
              {results.tasks.map((result) => {
                const idx = runningIndex++
                return (
                  <ResultItem
                    key={`task-${result.id}`}
                    result={result}
                    isActive={idx === activeIndex}
                    onSelect={() => selectResult(result)}
                    onHover={() => setActiveIndex(idx)}
                  />
                )
              })}
            </div>
          )}

          {/* Journal results */}
          {results.journals.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Journal
              </p>
              {results.journals.map((result) => {
                const idx = runningIndex++
                return (
                  <ResultItem
                    key={`journal-${result.id}`}
                    result={result}
                    isActive={idx === activeIndex}
                    onSelect={() => selectResult(result)}
                    onHover={() => setActiveIndex(idx)}
                  />
                )
              })}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              Searching...
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              No results found for "{query.trim()}"
            </div>
          )}
        </div>

        {/* Footer hints */}
        {hasResults && (
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[var(--border)]">
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[10px] font-mono text-[var(--text-secondary)]">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[10px] font-mono text-[var(--text-secondary)]">
                ↵
              </kbd>
              open
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[10px] font-mono text-[var(--text-secondary)]">
                esc
              </kbd>
              close
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Result item ──────────────────────────────────────────────────────────────

interface ResultItemProps {
  result: SearchResult
  isActive: boolean
  onSelect: () => void
  onHover: () => void
}

function ResultItem({ result, isActive, onSelect, onHover }: ResultItemProps) {
  const isTask = result.type === 'task'

  return (
    <button
      data-active={isActive}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        isActive
          ? 'bg-[var(--accent-bg)]'
          : 'hover:bg-[var(--bg-elevated)]'
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      {/* Icon */}
      <span
        className={cn(
          'shrink-0 flex items-center justify-center w-7 h-7 rounded',
          isActive
            ? 'text-[var(--accent)]'
            : 'text-[var(--text-muted)]'
        )}
      >
        {isTask ? <FileText size={16} /> : <BookOpen size={16} />}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Category dot for tasks */}
          {isTask && result.category_color && (
            <span
              className="shrink-0 w-2 h-2 rounded-full"
              style={{ backgroundColor: result.category_color }}
            />
          )}
          <span
            className={cn(
              'text-sm truncate',
              isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'
            )}
          >
            {result.title}
          </span>
          {isTask && result.status && (
            <span className="shrink-0 text-2xs text-[var(--text-muted)] capitalize">
              {result.status}
            </span>
          )}
        </div>
        {result.subtitle && (
          <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
            {result.subtitle}
          </p>
        )}
      </div>

      {/* Date badge for journal */}
      {!isTask && result.date && (
        <span className="shrink-0 text-xs text-[var(--text-muted)] tabular-nums">
          {result.date}
        </span>
      )}

      {/* Category label for tasks */}
      {isTask && result.category_label && (
        <span className="shrink-0 text-xs text-[var(--text-muted)]">
          {result.category_label}
        </span>
      )}
    </button>
  )
}
