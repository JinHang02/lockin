import { useState, useRef } from 'react'
import { Palette, Volume2, LogIn, Clock, Tag, Plus, Pencil, Trash2, Check, X, Play, Download, Upload, Database, Bell, Flame, Eye } from 'lucide-react'
import Button from '@/components/ui/Button'
import RecurringTasksSection from './RecurringTasksSection'
import { useAppStore } from '@/store/app.store'
import { useTaskStore } from '@/store/task.store'
import { useToastStore } from '@/store/toast.store'
import { SOUND_OPTIONS, playTimerSound } from '@/store/pomodoro.store'
import { cn } from '@/lib/utils'
import { DARK_THEMES, LIGHT_THEMES, type ThemeDef } from '@/lib/themes'
import type { Category } from '@/types'

const PRESET_COLORS = [
  '#6366f1', '#818cf8', '#a78bfa', '#f472b6', '#fb7185',
  '#f59e0b', '#34d399', '#22d3ee', '#60a5fa', '#e879f9',
]

function CategoryRow({ category, onUpdate, onDelete }: {
  category: Category
  onUpdate: (id: string, label: string, color: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(category.label)
  const [color, setColor] = useState(category.color)

  const handleSave = async () => {
    await onUpdate(category.id, label, color)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="flex gap-1 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                'w-5 h-5 rounded-full transition-transform',
                color === c ? 'scale-125 ring-2 ring-offset-1 ring-[var(--border)]' : 'hover:scale-110'
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1 h-8 px-2 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
        />
        <button onClick={handleSave} className="text-emerald-500 hover:text-emerald-400 focus-ring rounded">
          <Check size={15} />
        </button>
        <button onClick={() => setEditing(false)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] focus-ring rounded">
          <X size={15} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-2 group">
      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
      <span className="text-sm text-[var(--text-primary)] flex-1">{category.label}</span>
      {category.is_predefined ? (
        <span className="text-xs text-[var(--text-muted)]">Default</span>
      ) : null}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => { setLabel(category.label); setColor(category.color); setEditing(true) }}
          className="h-7 w-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors focus-ring"
        >
          <Pencil size={12} />
        </button>
        {!category.is_predefined && (
          <button
            onClick={() => onDelete(category.id)}
            className="h-7 w-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors focus-ring"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function ThemeCard({ theme, isSelected, onSelect }: {
  theme: ThemeDef
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all duration-150',
        isSelected
          ? 'ring-2 ring-[var(--accent)] bg-[var(--accent-bg)]'
          : 'hover:bg-[var(--bg-elevated)]'
      )}
    >
      <div
        className="w-full aspect-[4/3] rounded-md overflow-hidden"
        style={{
          backgroundColor: theme.preview.bg,
          boxShadow: isSelected
            ? `0 0 0 1.5px ${theme.preview.accent}`
            : `inset 0 0 0 1px ${theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}
      >
        <div className="h-full p-1.5 flex flex-col">
          <div
            className="flex-1 rounded-sm p-2 flex flex-col gap-1.5"
            style={{ backgroundColor: theme.preview.surface }}
          >
            <div
              className="h-1 w-8 rounded-full"
              style={{ backgroundColor: theme.preview.accent }}
            />
            <div
              className="h-[3px] w-11 rounded-full"
              style={{ backgroundColor: theme.preview.text, opacity: 0.3 }}
            />
            <div
              className="h-[3px] w-6 rounded-full"
              style={{ backgroundColor: theme.preview.text, opacity: 0.15 }}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {isSelected && (
          <Check size={10} className="text-[var(--accent)]" />
        )}
        <span className={cn(
          'text-[11px] font-medium',
          isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
        )}>
          {theme.name}
        </span>
      </div>
    </button>
  )
}

const SETTINGS_TABS = [
  { key: 'appearance', label: 'Appearance' },
  { key: 'timer',      label: 'Timer & Focus' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'tasks',      label: 'Tasks' },
  { key: 'data',       label: 'Data' },
] as const

type SettingsTab = typeof SETTINGS_TABS[number]['key']

export default function SettingsView() {
  const { settings, saveSetting, theme, loadSettings } = useAppStore()
  const { categories, createCategory, updateCategory, deleteCategory, loadTasks, loadCategories } = useTaskStore()
  const addToast = useToastStore((s) => s.addToast)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0])
  const [addingCat, setAddingCat] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')

  if (!settings) return null

  const handleAddCategory = async () => {
    if (!newCatLabel.trim()) return
    await createCategory(newCatLabel.trim(), newCatColor)
    setNewCatLabel('')
    setNewCatColor(PRESET_COLORS[0])
    setAddingCat(false)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await window.api.exportData()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lockin-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      addToast('Backup exported successfully')
    } catch {
      addToast('Failed to export backup', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      // Validate JSON structure before importing
      const parsed = JSON.parse(text)
      if (!parsed.version || !parsed.categories || !parsed.tasks) {
        throw new Error('Invalid backup file')
      }
      await window.api.importData(text)
      // Reload all data
      await loadSettings()
      await loadCategories()
      await loadTasks()
      addToast('Backup imported successfully')
    } catch {
      addToast('Failed to import backup - invalid file', 'error')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto px-6 py-6 space-y-8">
        <h1 className="text-lg font-display font-semibold text-[var(--text-primary)]">Settings</h1>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-elevated)]">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium transition-all duration-150',
                activeTab === tab.key
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-subtle'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Appearance */}
        {activeTab === 'appearance' && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Palette size={13} /> Appearance
          </h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-4">
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">Dark</p>
              <div className="grid grid-cols-3 gap-2">
                {DARK_THEMES.map((t) => (
                  <ThemeCard key={t.id} theme={t} isSelected={settings.theme === t.id} onSelect={() => saveSetting('theme', t.id)} />
                ))}
              </div>
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">Light</p>
              <div className="grid grid-cols-3 gap-2">
                {LIGHT_THEMES.map((t) => (
                  <ThemeCard key={t.id} theme={t} isSelected={settings.theme === t.id} onSelect={() => saveSetting('theme', t.id)} />
                ))}
              </div>
            </div>
          </div>
        </section>
        )}

        {/* Timer */}
        {activeTab === 'timer' && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock size={13} /> Timer
          </h2>
          <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] bg-[var(--bg-surface)]">
            {[
              { key: 'timer_work_minutes' as const,         label: 'Work session',  desc: 'minutes' },
              { key: 'timer_short_break_minutes' as const,  label: 'Short break',   desc: 'minutes' },
              { key: 'timer_long_break_minutes' as const,   label: 'Long break',    desc: 'minutes' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{settings[key]} {desc}</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={settings[key]}
                  onChange={(e) => saveSetting(key, e.target.value)}
                  className="w-16 h-8 px-2 text-sm text-center rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
                />
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Sound */}
        {activeTab === 'timer' && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Volume2 size={13} /> Sound
          </h2>
          <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] bg-[var(--bg-surface)]">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Timer sound</p>
                <p className="text-xs text-[var(--text-secondary)]">Play a sound when session ends</p>
              </div>
              <button
                onClick={() => saveSetting('sound_enabled', settings.sound_enabled === 'true' ? 'false' : 'true')}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-ring',
                  settings.sound_enabled === 'true' ? 'bg-accent-500' : 'bg-[var(--bg-overlay)]'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                    settings.sound_enabled === 'true' ? 'translate-x-4' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
            {settings.sound_enabled === 'true' && (
              <>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Volume</p>
                    <p className="text-xs text-[var(--text-secondary)]">{settings.sound_volume}%</p>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.sound_volume}
                    onChange={(e) => saveSetting('sound_volume', e.target.value)}
                    className="w-28 accent-accent-500"
                  />
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-2">Sound style</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SOUND_OPTIONS.map(({ value, label }) => (
                      <div
                        key={value}
                        className={cn(
                          'flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-100 border cursor-pointer',
                          (settings.sound_type ?? 'chime') === value
                            ? 'border-accent-500/50 bg-[var(--accent-bg)] text-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                        )}
                        onClick={() => saveSetting('sound_type', value)}
                      >
                        <span className="font-medium">{label}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); playTimerSound(value) }}
                          className="h-5 w-5 rounded flex items-center justify-center hover:bg-[var(--bg-overlay)] transition-colors"
                          title={`Preview ${label}`}
                        >
                          <Play size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
        )}

        {/* System */}
        {activeTab === 'data' && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <LogIn size={13} /> System
          </h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] divide-y divide-[var(--border)]">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Launch at startup</p>
                <p className="text-xs text-[var(--text-secondary)]">Auto-start LockIn when Windows boots</p>
              </div>
              <button
                onClick={() => saveSetting('start_on_login', settings.start_on_login === 'true' ? 'false' : 'true')}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-ring',
                  settings.start_on_login === 'true' ? 'bg-accent-500' : 'bg-[var(--bg-overlay)]'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                    settings.start_on_login === 'true' ? 'translate-x-4' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </div>
        </section>
        )}

        {/* Reminders */}
        {activeTab === 'notifications' && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Bell size={13} /> Reminders
          </h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] divide-y divide-[var(--border)]">
            {/* Master toggle */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Enable reminders</p>
                <p className="text-xs text-[var(--text-secondary)]">Show desktop notifications for nudges</p>
              </div>
              <button
                onClick={() => saveSetting('reminders_enabled', settings.reminders_enabled === 'true' ? 'false' : 'true')}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-ring',
                  settings.reminders_enabled === 'true' ? 'bg-accent-500' : 'bg-[var(--bg-overlay)]'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                    settings.reminders_enabled === 'true' ? 'translate-x-4' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
            {settings.reminders_enabled === 'true' && (
              <>
                {/* No-session nudge */}
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">No-session nudge</p>
                      <p className="text-xs text-[var(--text-secondary)]">Remind if no focus sessions started today</p>
                    </div>
                    <button
                      onClick={() => saveSetting('reminder_nudge_enabled', settings.reminder_nudge_enabled === 'true' ? 'false' : 'true')}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-ring',
                        settings.reminder_nudge_enabled === 'true' ? 'bg-accent-500' : 'bg-[var(--bg-overlay)]'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                          settings.reminder_nudge_enabled === 'true' ? 'translate-x-4' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                  {settings.reminder_nudge_enabled === 'true' && (
                    <div className="flex items-center gap-2 pl-1">
                      <span className="text-xs text-[var(--text-secondary)]">Remind after</span>
                      <select
                        value={settings.reminder_nudge_hour}
                        onChange={(e) => saveSetting('reminder_nudge_hour', e.target.value)}
                        className="h-7 px-2 text-xs rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
                      >
                        {Array.from({ length: 15 }, (_, i) => i + 6).map((h) => (
                          <option key={h} value={String(h)}>
                            {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-[var(--text-muted)]">(weekdays only)</span>
                    </div>
                  )}
                </div>
                {/* Due-task reminder */}
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">Due-task reminder</p>
                      <p className="text-xs text-[var(--text-secondary)]">Notify about tasks due today</p>
                    </div>
                    <button
                      onClick={() => saveSetting('reminder_due_enabled', settings.reminder_due_enabled === 'true' ? 'false' : 'true')}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-ring',
                        settings.reminder_due_enabled === 'true' ? 'bg-accent-500' : 'bg-[var(--bg-overlay)]'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                          settings.reminder_due_enabled === 'true' ? 'translate-x-4' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                  {settings.reminder_due_enabled === 'true' && (
                    <div className="flex items-center gap-2 pl-1">
                      <span className="text-xs text-[var(--text-secondary)]">Remind after</span>
                      <select
                        value={settings.reminder_due_hour}
                        onChange={(e) => saveSetting('reminder_due_hour', e.target.value)}
                        className="h-7 px-2 text-xs rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
                      >
                        {Array.from({ length: 15 }, (_, i) => i + 6).map((h) => (
                          <option key={h} value={String(h)}>
                            {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
        )}

        {/* Focus Mode */}
        {activeTab === 'timer' && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Eye size={13} /> Focus Mode
          </h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] divide-y divide-[var(--border)]">
            <div className="px-4 py-3">
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">During Pomodoro sessions</p>
              <p className="text-xs text-[var(--text-secondary)] mb-3">Control how the UI behaves when a timer is active</p>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { value: 'off', label: 'Off', desc: 'No restrictions' },
                  { value: 'dim', label: 'Dim', desc: 'Dims board content' },
                  { value: 'zen', label: 'Zen', desc: 'Blocks other screens' },
                ] as const).map(({ value, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => saveSetting('focus_mode', value)}
                    className={cn(
                      'flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg text-sm transition-all duration-100 border',
                      (settings.focus_mode ?? 'dim') === value
                        ? 'border-accent-500/50 bg-[var(--accent-bg)] text-[var(--accent)]'
                        : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <span className="font-medium">{label}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
        )}

        {/* Streak Protection */}
        {activeTab === 'tasks' && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Flame size={13} /> Streak Protection
          </h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] divide-y divide-[var(--border)]">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Grace days</p>
                <p className="text-xs text-[var(--text-secondary)]">Allow missed days without breaking your streak</p>
              </div>
              <select
                value={settings.streak_grace_days ?? '0'}
                onChange={(e) => saveSetting('streak_grace_days', e.target.value)}
                className="h-8 px-2 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
              >
                <option value="0">None (strict)</option>
                <option value="1">1 day</option>
                <option value="2">2 days</option>
                <option value="3">3 days (weekends)</option>
              </select>
            </div>
          </div>
        </section>
        )}

        {/* Categories */}
        {activeTab === 'tasks' && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Tag size={13} /> Categories
          </h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] divide-y divide-[var(--border)]">
            <div className="px-4 py-1 divide-y divide-[var(--border)]">
              {categories.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  onUpdate={updateCategory}
                  onDelete={deleteCategory}
                />
              ))}
            </div>

            {/* Add category */}
            <div className="px-4 py-3">
              {addingCat ? (
                <div className="space-y-2">
                  <div className="flex gap-1 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewCatColor(c)}
                        className={cn(
                          'w-5 h-5 rounded-full transition-transform',
                          newCatColor === c ? 'scale-125 ring-2 ring-offset-1 ring-[var(--border)]' : 'hover:scale-110'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={newCatLabel}
                      onChange={(e) => setNewCatLabel(e.target.value)}
                      placeholder="Category name"
                      className="flex-1 h-8 px-2 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-accent-500/40"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setAddingCat(false) }}
                    />
                    <Button size="sm" variant="accent" onClick={handleAddCategory} disabled={!newCatLabel.trim()}>
                      Add
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingCat(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddingCat(true)}
                  className="w-full justify-start text-[var(--text-secondary)]"
                >
                  <Plus size={13} />
                  Add category
                </Button>
              )}
            </div>
          </div>
        </section>
        )}

        {/* Recurring Tasks */}
        {activeTab === 'tasks' && (
        <RecurringTasksSection categories={categories} />
        )}

        {/* Backup & Data */}
        {activeTab === 'data' && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Database size={13} /> Backup & Data
          </h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] divide-y divide-[var(--border)]">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Export backup</p>
                <p className="text-xs text-[var(--text-secondary)]">Download all data as JSON</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
                <Download size={12} />
                {exporting ? 'Exporting...' : 'Export'}
              </Button>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Import backup</p>
                <p className="text-xs text-[var(--text-secondary)]">Restore from a backup file (replaces all data)</p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload size={12} />
                  {importing ? 'Importing...' : 'Import'}
                </Button>
              </div>
            </div>
          </div>
        </section>
        )}
      </div>
    </div>
  )
}
