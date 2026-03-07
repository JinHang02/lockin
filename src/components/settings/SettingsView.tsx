import { useState } from 'react'
import { Sun, Moon, Volume2, LogIn, Clock, Tag, Plus, Pencil, Trash2, Check, X, Play } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useAppStore } from '@/store/app.store'
import { useTaskStore } from '@/store/task.store'
import { SOUND_OPTIONS, playTimerSound } from '@/store/pomodoro.store'
import { cn } from '@/lib/utils'
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

export default function SettingsView() {
  const { settings, saveSetting, theme } = useAppStore()
  const { categories, createCategory, updateCategory, deleteCategory } = useTaskStore()
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0])
  const [addingCat, setAddingCat] = useState(false)

  if (!settings) return null

  const handleAddCategory = async () => {
    if (!newCatLabel.trim()) return
    await createCategory(newCatLabel.trim(), newCatColor)
    setNewCatLabel('')
    setNewCatColor(PRESET_COLORS[0])
    setAddingCat(false)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto px-6 py-6 space-y-8">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h1>

        {/* Appearance */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sun size={13} /> Appearance
          </h2>
          <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] bg-[var(--bg-surface)]">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Theme</p>
                <p className="text-xs text-[var(--text-secondary)]">Light or dark mode</p>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-elevated)]">
                {(['light', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => saveSetting('theme', t)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-150',
                      theme === t
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-subtle'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    {t === 'light' ? <Sun size={12} /> : <Moon size={12} />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Timer */}
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

        {/* Sound */}
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

        {/* System */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <LogIn size={13} /> System
          </h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
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

        {/* Categories */}
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
      </div>
    </div>
  )
}
