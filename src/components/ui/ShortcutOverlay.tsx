import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const SHORTCUTS = [
  { section: 'General', items: [
    { keys: ['?'], desc: 'Toggle this overlay' },
    { keys: ['Ctrl', 'K'], desc: 'Search palette' },
    { keys: ['N'], desc: 'Focus quick add input' },
    { keys: ['Ctrl', 'N'], desc: 'Open full task form' },
  ]},
  { section: 'Navigation', items: [
    { keys: ['1'], desc: "Today's Board" },
    { keys: ['2'], desc: 'Calendar' },
    { keys: ['3'], desc: 'Journal' },
    { keys: ['4'], desc: 'Notes' },
    { keys: ['5'], desc: 'Analytics' },
    { keys: ['6'], desc: 'Settings' },
  ]},
  { section: 'Board', items: [
    { keys: ['\u2191', '\u2193'], desc: 'Navigate tasks' },
    { keys: ['Enter'], desc: 'Edit focused task' },
    { keys: ['D'], desc: 'Toggle done/todo' },
    { keys: ['P'], desc: 'Start pomodoro' },
    { keys: ['Esc'], desc: 'Clear focus' },
  ]},
  { section: 'Timer', items: [
    { keys: ['Space'], desc: 'Pause / resume timer' },
    { keys: ['Esc'], desc: 'Pause timer' },
  ]},
]

export default function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-label="Keyboard shortcuts"
      aria-modal="true"
    >
      <div
        ref={overlayRef}
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-elevated p-6 w-full max-w-md animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            aria-label="Close shortcuts"
          >
            <X size={15} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          {SHORTCUTS.map(({ section, items }) => (
            <div key={section}>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                {section}
              </p>
              <div className="space-y-1.5">
                {items.map(({ keys, desc }) => (
                  <div key={desc} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--text-primary)]">{desc}</span>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {keys.map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-[var(--text-muted)] text-[10px] mx-0.5">+</span>}
                          <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[10px] font-mono text-[var(--text-secondary)]">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--text-muted)] mt-5 text-center">
          Press <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[10px] font-mono text-[var(--text-secondary)]">?</kbd> to dismiss
        </p>
      </div>
    </div>
  )
}
