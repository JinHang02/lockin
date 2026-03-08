import { useState, useEffect, useCallback, useRef } from 'react'
import { useCodeMirror } from './useCodeMirror'
import { todayISO, formatMinutes, formatTimeRange, formatDateLabel } from '@/lib/utils'
import { Angry, Frown, Meh, Smile, Laugh, ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import { format, addDays, subDays } from 'date-fns'
import type { JournalEntry, AutoSummary } from '@/types'

export default function JournalView() {
  const [date, setDate] = useState(todayISO())
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [intention, setIntention] = useState('')
  const [mood, setMood] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editorRef = useRef<HTMLDivElement>(null)
  const { setDoc } = useCodeMirror(editorRef, {
    onChange: (value) => scheduleSave({ narrative: value })
  })

  const isToday = date === todayISO()

  useEffect(() => {
    setLoading(true)
    setSaveStatus('saved')
    window.api.getJournalByDate(date).then((data) => {
      setEntry(data)
      setIntention(data.intention ?? '')
      setMood(data.mood ?? null)
      setDoc(data.narrative ?? '')
    }).catch(() => {
      setEntry(null)
      setIntention('')
      setMood(null)
      setDoc('')
    }).finally(() => {
      setLoading(false)
    })
  }, [date])

  const scheduleSave = useCallback((fields: { narrative?: string; intention?: string; mood?: number | null }) => {
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await window.api.upsertJournal({ date, ...fields })
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
      }
    }, 800)
  }, [date])

  const handleIntentionChange = (v: string) => {
    setIntention(v)
    scheduleSave({ intention: v })
  }

  const handleMoodChange = (v: number) => {
    const newMood = mood === v ? null : v
    setMood(newMood)
    scheduleSave({ mood: newMood })
  }

  const autoSummary: AutoSummary | null = entry?.auto_summary
    ? (() => { try { return JSON.parse(entry.auto_summary) } catch { return null } })()
    : null

  const hasSummary = autoSummary && (autoSummary.session_count > 0 || autoSummary.tasks_completed.length > 0)

  const goBack = () => setDate((d) => format(subDays(new Date(d + 'T00:00:00'), 1), 'yyyy-MM-dd'))
  const goForward = () => {
    const next = format(addDays(new Date(date + 'T00:00:00'), 1), 'yyyy-MM-dd')
    if (next <= todayISO()) setDate(next)
  }

  const MOODS = [
    { value: 1, icon: Angry,   label: 'Rough' },
    { value: 2, icon: Frown,   label: 'Low' },
    { value: 3, icon: Meh,     label: 'Okay' },
    { value: 4, icon: Smile,   label: 'Good' },
    { value: 5, icon: Laugh,   label: 'Great' },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--border)] px-6 py-4 bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ChevronLeft size={16} />
          </Button>
          <h2 className="flex-1 text-center text-base font-display font-semibold text-[var(--text-primary)]">
            {formatDateLabel(date)}
            {isToday && (
              <span className="ml-2 text-xs text-accent-400 font-normal">(today)</span>
            )}
          </h2>
          <Button variant="ghost" size="icon" onClick={goForward} disabled={isToday} title={isToday ? "Can't go past today" : 'Next day'}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">

          {/* Morning intention */}
          {isToday ? (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                Morning intention
              </label>
              <input
                type="text"
                value={intention}
                onChange={(e) => handleIntentionChange(e.target.value)}
                placeholder="What matters most today?"
                className="w-full h-9 px-3 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
              />
            </div>
          ) : intention ? (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                Intention
              </label>
              <p className="text-sm text-[var(--text-primary)] italic px-1">"{intention}"</p>
            </div>
          ) : null}

          {/* Auto-summary */}
          {hasSummary && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Day summary
              </p>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                    {formatMinutes(autoSummary!.total_focus_minutes)}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">focused</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                    {autoSummary!.session_count}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">session{autoSummary!.session_count !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {autoSummary!.tasks_completed.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-[var(--text-secondary)] mb-1.5">Completed</p>
                  <ul className="space-y-1">
                    {autoSummary!.tasks_completed.map((t, i) => (
                      <li key={i} className="text-sm text-[var(--text-primary)] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {autoSummary!.blocks.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--text-secondary)] mb-1.5">Time blocks</p>
                  <div className="space-y-1">
                    {autoSummary!.blocks.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <span
                          className="w-2 h-2 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: b.color_tag }}
                        />
                        <span className="text-[var(--text-primary)] font-medium">{b.task_title}</span>
                        <span className="text-[var(--text-muted)]">{formatTimeRange(b.start_time, b.end_time)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mood */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Mood <span className="text-[var(--text-muted)] normal-case font-normal">(optional)</span>
            </p>
            <div className="flex items-center gap-2">
              {MOODS.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => handleMoodChange(value)}
                  title={label}
                  className={`h-9 w-9 rounded flex items-center justify-center transition-all duration-100 ${
                    mood === value
                      ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Icon size={18} />
                </button>
              ))}
              {mood !== null && (
                <button
                  onClick={() => handleMoodChange(mood)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Markdown editor */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Journal
            </p>
            <div
              ref={editorRef}
              className="min-h-[280px] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 focus-within:ring-2 focus-within:ring-accent-500/30"
            />
            <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--text-muted)]">
              <span>Markdown supported</span>
              <span className="w-px h-3 bg-[var(--border)]" />
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  saveStatus === 'saved' ? 'bg-emerald-500' :
                  saveStatus === 'saving' ? 'bg-amber-400' : 'bg-[var(--text-muted)]'
                }`} />
                {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
