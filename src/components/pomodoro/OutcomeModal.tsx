import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle2, RefreshCw, AlertCircle, Coffee } from 'lucide-react'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import { usePomodoroStore } from '@/store/pomodoro.store'
import { useToastStore } from '@/store/toast.store'

const OUTCOME_OPTIONS = [
  {
    value: 'done' as const,
    label: 'Done',
    description: 'Task is complete',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60'
  },
  {
    value: 'still-going' as const,
    label: 'Still going',
    description: 'Need another session',
    icon: RefreshCw,
    color: 'text-accent-400',
    bg: 'bg-accent-500/10 border-accent-500/30 hover:border-accent-500/60'
  },
  {
    value: 'blocked' as const,
    label: 'Blocked',
    description: 'Something is in the way',
    icon: AlertCircle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60'
  }
]

export default function OutcomeModal() {
  const { activeTask, completeSession, dismissOutcome, startBreakSession, phase, sessionCount } = usePomodoroStore()
  const addToast = useToastStore((s) => s.addToast)
  const [blockNote, setBlockNote] = useState('')
  const [selectedOutcome, setSelectedOutcome] = useState<'done' | 'still-going' | 'blocked' | null>(null)
  const [step, setStep] = useState<'outcome' | 'break'>('outcome')
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const blockNoteRef = useRef(blockNote)
  blockNoteRef.current = blockNote

  const handleSubmit = useCallback(async () => {
    if (!selectedOutcome) return
    await completeSession(selectedOutcome, blockNoteRef.current || undefined)
    addToast('Session saved')
    setStep('break')
  }, [selectedOutcome, completeSession, addToast])

  // Arrow key navigation for outcome options
  useEffect(() => {
    if (step !== 'outcome') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex((prev) => {
          const next = e.key === 'ArrowDown'
            ? Math.min(prev + 1, OUTCOME_OPTIONS.length - 1)
            : Math.max(prev - 1, 0)
          setSelectedOutcome(OUTCOME_OPTIONS[next].value)
          return next
        })
      }
      if (e.key === 'Enter' && selectedOutcome) {
        handleSubmit()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [step, selectedOutcome, handleSubmit])

  const handleStartBreak = () => {
    startBreakSession()
    dismissOutcome()
    addToast('Break started — relax!')
  }

  const handleSkipBreak = () => {
    dismissOutcome()
  }

  // Default dismiss: mark as still-going (safe default, doesn't lose data)
  const handleDefaultDismiss = async () => {
    await completeSession('still-going')
    addToast('Session saved as "still going"')
    dismissOutcome()
  }

  // Break prompt after saving outcome
  if (step === 'break') {
    const breakType = (sessionCount % 4 === 0) ? 'long break' : 'short break'
    return (
      <Dialog
        open={true}
        onClose={handleSkipBreak}
        title="Take a break?"
      >
        <div className="text-center py-2">
          <Coffee size={32} className="mx-auto mb-3 text-emerald-500" aria-hidden="true" />
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            You've earned a <span className="font-medium text-[var(--text-primary)]">{breakType}</span>.
            Taking regular breaks helps maintain focus.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="lg" className="flex-1" onClick={handleSkipBreak}>
              Skip
            </Button>
            <Button variant="accent" size="lg" className="flex-1" onClick={handleStartBreak}>
              Start break
            </Button>
          </div>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={true}
      onClose={handleDefaultDismiss}
      title="Session complete"
    >
      {activeTask && (
        <p className="text-sm text-[var(--text-secondary)] mb-5 -mt-1">
          How did{' '}
          <span className="font-medium text-[var(--text-primary)]">
            &ldquo;{activeTask.title}&rdquo;
          </span>{' '}
          go?
        </p>
      )}

      <div className="space-y-2 mb-5" role="radiogroup" aria-label="Session outcome">
        {OUTCOME_OPTIONS.map(({ value, label, description, icon: Icon, color, bg }, idx) => (
          <button
            key={value}
            onClick={() => { setSelectedOutcome(value); setFocusedIndex(idx) }}
            role="radio"
            aria-checked={selectedOutcome === value}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-100 text-left ${
              selectedOutcome === value
                ? bg.replace('hover:', '') + ' border-opacity-100'
                : 'border-[var(--border)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            <Icon size={18} className={selectedOutcome === value ? color : 'text-[var(--text-muted)]'} aria-hidden="true" />
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
              <div className="text-xs text-[var(--text-secondary)]">{description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Block note — shown when blocked is selected */}
      {selectedOutcome === 'blocked' && (
        <div className="mb-5">
          <label htmlFor="block-note" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            What's blocking you? <span className="text-[var(--text-muted)]">(optional)</span>
          </label>
          <input
            id="block-note"
            autoFocus
            type="text"
            value={blockNote}
            onChange={(e) => setBlockNote(e.target.value)}
            placeholder="e.g. Waiting for feedback from team"
            className="w-full h-9 px-3 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          />
        </div>
      )}

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        disabled={!selectedOutcome}
        onClick={handleSubmit}
      >
        Save & continue
      </Button>

      <p className="text-xs text-[var(--text-muted)] text-center mt-3">
        Use arrow keys to select, Enter to confirm
      </p>
    </Dialog>
  )
}
