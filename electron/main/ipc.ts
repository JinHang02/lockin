import { ipcMain, app, BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from './database'
import { IPC } from './channels'
import type {
  Task, Category, PomodoroSession, CalendarBlock,
  JournalEntry, Settings, CreateTaskInput, UpdateTaskInput,
  CreateSessionInput, JournalUpsertInput, CategoryInput
} from '../../src/types'

function handle<T>(channel: string, fn: (args: T) => unknown): void {
  ipcMain.handle(channel, (_event, args: T) => fn(args))
}

function localISOString(date: Date = new Date()): string {
  const yyyy = date.getFullYear()
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}`
}

function localToday(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function localYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function registerIpcHandlers(): void {
  const db = getDb()

  // ── Categories ──────────────────────────────────────────────────────────────

  handle<void>(IPC.CATEGORIES_GET_ALL, () => {
    return db.prepare('SELECT * FROM categories ORDER BY is_predefined DESC, label ASC').all() as Category[]
  })

  handle<CategoryInput>(IPC.CATEGORIES_CREATE, ({ label, color }) => {
    const id = uuidv4()
    db.prepare('INSERT INTO categories (id, label, color, is_predefined) VALUES (?, ?, ?, 0)')
      .run(id, label, color)
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category
  })

  handle<{ id: string; label?: string; color?: string }>(IPC.CATEGORIES_UPDATE, ({ id, label, color }) => {
    if (label !== undefined) db.prepare('UPDATE categories SET label = ? WHERE id = ?').run(label, id)
    if (color !== undefined) db.prepare('UPDATE categories SET color = ? WHERE id = ?').run(color, id)
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category
  })

  handle<{ id: string }>(IPC.CATEGORIES_DELETE, ({ id }) => {
    const cat = db.prepare('SELECT is_predefined FROM categories WHERE id = ?').get(id) as { is_predefined: number } | undefined
    if (!cat || cat.is_predefined) throw new Error('Cannot delete predefined category')
    db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    return { success: true }
  })

  // ── Tasks ───────────────────────────────────────────────────────────────────

  handle<void>(IPC.TASKS_GET_TODAY, () => {
    const today = localToday()
    return db.prepare(`
      SELECT t.*, c.label as category_label, c.color as category_color
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE DATE(t.created_at) = ?
        OR DATE(t.carry_over_date) = ?
        OR DATE(t.completed_at) = ?
      ORDER BY t.priority ASC, t.created_at ASC
    `).all(today, today, today) as Task[]
  })

  handle<void>(IPC.TASKS_GET_CARRYOVER, () => {
    const today = localToday()
    return db.prepare(`
      SELECT t.*, c.label as category_label, c.color as category_color
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.status IN ('todo','in-progress','blocked')
        AND DATE(t.created_at) < ?
        AND (t.carry_over_date IS NULL OR DATE(t.carry_over_date) < ?)
      ORDER BY t.created_at ASC
    `).all(today, today) as Task[]
  })

  handle<CreateTaskInput>(IPC.TASKS_CREATE, (input) => {
    const id = uuidv4()
    const now = localISOString()
    const maxPriority = (db.prepare('SELECT MAX(priority) as m FROM tasks').get() as { m: number | null }).m ?? -1
    db.prepare(`
      INSERT INTO tasks (id, title, status, priority, category_id, notes, created_at)
      VALUES (?, ?, 'todo', ?, ?, ?, ?)
    `).run(id, input.title, maxPriority + 1, input.category_id ?? null, input.notes ?? null, now)
    return db.prepare(`
      SELECT t.*, c.label as category_label, c.color as category_color
      FROM tasks t LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(id) as Task
  })

  const ALLOWED_TASK_COLUMNS = new Set([
    'title', 'status', 'priority', 'category_id', 'notes',
    'completed_at', 'carry_over_date'
  ])

  handle<UpdateTaskInput>(IPC.TASKS_UPDATE, (input) => {
    const { id, ...rest } = input
    const now = localISOString()
    // Ensure completed_at is set when marking done
    const fields: Record<string, unknown> = { ...rest }
    if (fields['status'] === 'done' && !fields['completed_at']) {
      fields['completed_at'] = now
    }
    const keys = Object.keys(fields).filter(k => fields[k] !== undefined && ALLOWED_TASK_COLUMNS.has(k))
    if (keys.length > 0) {
      const setClauses = keys.map(k => `${k} = ?`).join(', ')
      const values = keys.map(k => fields[k] ?? null)
      db.prepare(`UPDATE tasks SET ${setClauses} WHERE id = ?`).run(...(values as string[]), id)
    }
    return db.prepare(`
      SELECT t.*, c.label as category_label, c.color as category_color
      FROM tasks t LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(id) as Task
  })

  handle<{ id: string }>(IPC.TASKS_DELETE, ({ id }) => {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    return { success: true }
  })

  handle<{ ids: string[] }>(IPC.TASKS_REORDER, ({ ids }) => {
    const update = db.prepare('UPDATE tasks SET priority = ? WHERE id = ?')
    const reorder = db.transaction((orderedIds: string[]) => {
      orderedIds.forEach((id, idx) => update.run(idx, id))
    })
    reorder(ids)
    return { success: true }
  })

  handle<{ id: string; action: 'keep' | 'drop' }>(IPC.TASKS_RESOLVE_CARRY, ({ id, action }) => {
    if (action === 'keep') {
      db.prepare('UPDATE tasks SET carry_over_date = ? WHERE id = ?').run(localToday(), id)
    } else {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    }
    return { success: true }
  })

  // ── Pomodoro Sessions ────────────────────────────────────────────────────────

  handle<CreateSessionInput>(IPC.SESSIONS_CREATE, (input) => {
    const sessionId = uuidv4()
    const blockId = uuidv4()

    db.prepare(`
      INSERT INTO pomodoro_sessions (id, task_id, started_at, ended_at, duration_minutes, outcome, block_note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      input.task_id,
      input.started_at,
      input.ended_at,
      input.duration_minutes,
      input.outcome,
      input.block_note ?? null
    )

    const task = db.prepare('SELECT category_id FROM tasks WHERE id = ?').get(input.task_id) as { category_id: string | null }
    const category = task?.category_id
      ? (db.prepare('SELECT color FROM categories WHERE id = ?').get(task.category_id) as { color: string } | undefined)
      : undefined
    const colorTag = category?.color ?? '#6366f1'

    // Use local date from the session start time
    const sessionStart = new Date(input.started_at)
    const date = `${sessionStart.getFullYear()}-${String(sessionStart.getMonth() + 1).padStart(2, '0')}-${String(sessionStart.getDate()).padStart(2, '0')}`
    db.prepare(`
      INSERT INTO calendar_blocks (id, session_id, task_id, start_time, end_time, date, color_tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(blockId, sessionId, input.task_id, input.started_at, input.ended_at, date, colorTag)

    return { session_id: sessionId, block_id: blockId }
  })

  handle<{ date: string }>(IPC.SESSIONS_GET_BY_DATE, ({ date }) => {
    return db.prepare(`
      SELECT ps.*, t.title as task_title
      FROM pomodoro_sessions ps
      JOIN tasks t ON ps.task_id = t.id
      WHERE DATE(ps.started_at) = ?
      ORDER BY ps.started_at ASC
    `).all(date) as PomodoroSession[]
  })

  // ── Session counts per task (for today's board badges) ──────────────────

  handle<void>(IPC.SESSIONS_COUNT_BY_TASK, () => {
    const rows = db.prepare(`
      SELECT task_id, COUNT(*) as count
      FROM pomodoro_sessions
      GROUP BY task_id
    `).all() as Array<{ task_id: string; count: number }>
    return rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.task_id] = r.count
      return acc
    }, {})
  })

  // ── Today's stats (session count + total focus minutes) ────────────────

  handle<void>(IPC.SESSIONS_TODAY_STATS, () => {
    const today = localToday()
    const row = db.prepare(`
      SELECT COUNT(*) as session_count, COALESCE(SUM(duration_minutes), 0) as total_minutes
      FROM pomodoro_sessions
      WHERE DATE(started_at) = ?
    `).get(today) as { session_count: number; total_minutes: number }
    return row
  })

  // ── Streak (consecutive days with at least one session) ─────────────────

  handle<void>(IPC.SESSIONS_STREAK, () => {
    // Get distinct dates with sessions, ordered descending
    const rows = db.prepare(`
      SELECT DISTINCT DATE(started_at) as d
      FROM pomodoro_sessions
      ORDER BY d DESC
    `).all() as Array<{ d: string }>

    if (rows.length === 0) return 0

    const today = localToday()
    const yesterday = localYesterday()

    // Streak must include today or yesterday
    if (rows[0].d !== today && rows[0].d !== yesterday) return 0

    let streak = 1
    for (let i = 1; i < rows.length; i++) {
      const prev = new Date(rows[i - 1].d + 'T00:00:00')
      const curr = new Date(rows[i].d + 'T00:00:00')
      const diffDays = (prev.getTime() - curr.getTime()) / 86400000
      if (diffDays === 1) {
        streak++
      } else {
        break
      }
    }
    return streak
  })

  // ── Calendar ─────────────────────────────────────────────────────────────────

  handle<{ date: string }>(IPC.CALENDAR_GET_BY_DATE, ({ date }) => {
    return db.prepare(`
      SELECT cb.*, t.title as task_title, ps.outcome, ps.duration_minutes
      FROM calendar_blocks cb
      JOIN tasks t ON cb.task_id = t.id
      JOIN pomodoro_sessions ps ON cb.session_id = ps.id
      WHERE cb.date = ?
      ORDER BY cb.start_time ASC
    `).all(date) as CalendarBlock[]
  })

  // ── Journal ──────────────────────────────────────────────────────────────────

  handle<{ date: string }>(IPC.JOURNAL_GET_BY_DATE, ({ date }) => {
    let entry = db.prepare('SELECT * FROM journal_entries WHERE date = ?').get(date) as JournalEntry | undefined

    // Compute auto_summary from sessions on this date
    const sessions = db.prepare(`
      SELECT ps.duration_minutes, ps.outcome, ps.started_at, ps.ended_at,
             t.title as task_title, cb.start_time, cb.end_time, cb.color_tag
      FROM pomodoro_sessions ps
      JOIN tasks t ON ps.task_id = t.id
      LEFT JOIN calendar_blocks cb ON cb.session_id = ps.id
      WHERE DATE(ps.started_at) = ?
    `).all(date) as Array<{
      duration_minutes: number
      outcome: string
      task_title: string
      start_time: string
      end_time: string
      color_tag: string
    }>

    const completedTasks = db.prepare(`
      SELECT DISTINCT t.title FROM tasks t
      JOIN pomodoro_sessions ps ON ps.task_id = t.id
      WHERE DATE(ps.started_at) = ? AND ps.outcome = 'done'
    `).all(date) as Array<{ title: string }>

    const auto_summary = JSON.stringify({
      session_count: sessions.length,
      total_focus_minutes: sessions.reduce((sum, s) => sum + s.duration_minutes, 0),
      tasks_completed: completedTasks.map(t => t.title),
      blocks: sessions.map(s => ({
        task_title: s.task_title,
        start_time: s.start_time,
        end_time: s.end_time,
        color_tag: s.color_tag,
        outcome: s.outcome
      }))
    })

    if (!entry) {
      const id = uuidv4()
      db.prepare(`
        INSERT INTO journal_entries (id, date, auto_summary) VALUES (?, ?, ?)
      `).run(id, date, auto_summary)
      entry = db.prepare('SELECT * FROM journal_entries WHERE date = ?').get(date) as JournalEntry
    } else {
      db.prepare('UPDATE journal_entries SET auto_summary = ? WHERE date = ?').run(auto_summary, date)
      entry = { ...entry, auto_summary }
    }

    return entry
  })

  handle<JournalUpsertInput>(IPC.JOURNAL_UPSERT, (input) => {
    const existing = db.prepare('SELECT id FROM journal_entries WHERE date = ?').get(input.date)
    if (existing) {
      const setClauses: string[] = []
      const values: unknown[] = []
      if (input.intention  !== undefined) { setClauses.push('intention = ?');  values.push(input.intention) }
      if (input.narrative  !== undefined) { setClauses.push('narrative = ?');  values.push(input.narrative) }
      if (input.mood       !== undefined) { setClauses.push('mood = ?');       values.push(input.mood) }
      if (setClauses.length > 0) {
        db.prepare(`UPDATE journal_entries SET ${setClauses.join(', ')} WHERE date = ?`).run(...values, input.date)
      }
    } else {
      const id = uuidv4()
      db.prepare(`
        INSERT INTO journal_entries (id, date, intention, narrative, mood, auto_summary)
        VALUES (?, ?, ?, ?, ?, '{}')
      `).run(id, input.date, input.intention ?? null, input.narrative ?? null, input.mood ?? null)
    }
    return db.prepare('SELECT * FROM journal_entries WHERE date = ?').get(input.date) as JournalEntry
  })

  // ── Settings ─────────────────────────────────────────────────────────────────

  handle<void>(IPC.SETTINGS_GET, () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
    return rows.reduce<Settings>((acc, { key, value }) => ({ ...acc, [key]: value }), {} as Settings)
  })

  handle<{ key: string; value: string }>(IPC.SETTINGS_SET, ({ key, value }) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
    return { success: true }
  })

  // ── System ───────────────────────────────────────────────────────────────────

  handle<{ enabled: boolean }>(IPC.SET_LOGIN_ITEM, ({ enabled }) => {
    app.setLoginItemSettings({ openAtLogin: enabled })
    return { success: true }
  })

  handle<{ title: string }>(IPC.SET_WINDOW_TITLE, ({ title }) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (win) win.setTitle(title)
    return { success: true }
  })

  handle<{ tooltip: string }>(IPC.SET_TRAY_TOOLTIP, ({ tooltip }) => {
    const { getTray } = require('./index')
    const tray = getTray()
    if (tray) tray.setToolTip(tooltip)
    return { success: true }
  })
}
