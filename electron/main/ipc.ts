import { ipcMain, app, BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from './database'
import { IPC } from './channels'
import type {
  Task, Category, PomodoroSession, CalendarBlock,
  JournalEntry, Note, Settings, CreateTaskInput, UpdateTaskInput,
  CreateSessionInput, JournalUpsertInput, CreateNoteInput, UpdateNoteInput, CategoryInput,
  RecurringTask, CreateRecurringTaskInput, UpdateRecurringTaskInput
} from '../../src/types'

// ── Error-safe IPC handler wrapper ──────────────────────────────────────────

function handle<T>(channel: string, fn: (args: T) => unknown): void {
  ipcMain.handle(channel, async (_event, args: T) => {
    try {
      return fn(args)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[IPC ${channel}]`, message)
      throw new Error(message)
    }
  })
}

// ── Validation helpers ──────────────────────────────────────────────────────

function validateNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`)
  }
  return value.trim()
}

function validateMaxLength(value: string, max: number, field: string): string {
  if (value.length > max) {
    throw new Error(`${field} must be ${max} characters or fewer`)
  }
  return value
}

// ── Date helpers (local time, never UTC) ───────────────────────────────────

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

function localDateISO(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function registerIpcHandlers(): void {
  const db = getDb()

  // ── Categories ──────────────────────────────────────────────────────────────

  handle<void>(IPC.CATEGORIES_GET_ALL, () => {
    return db.prepare('SELECT * FROM categories ORDER BY is_predefined DESC, label ASC').all() as Category[]
  })

  handle<CategoryInput>(IPC.CATEGORIES_CREATE, ({ label, color }) => {
    const trimmed = validateNonEmpty(label, 'Label')
    validateMaxLength(trimmed, 50, 'Label')
    const id = uuidv4()
    db.prepare('INSERT INTO categories (id, label, color, is_predefined) VALUES (?, ?, ?, 0)')
      .run(id, trimmed, color)
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category
  })

  handle<{ id: string; label?: string; color?: string }>(IPC.CATEGORIES_UPDATE, ({ id, label, color }) => {
    if (label !== undefined) {
      const trimmed = validateNonEmpty(label, 'Label')
      validateMaxLength(trimmed, 50, 'Label')
      db.prepare('UPDATE categories SET label = ? WHERE id = ?').run(trimmed, id)
    }
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

  handle<void>(IPC.TASKS_COMPLETED_HISTORY, () => {
    const today = localToday()
    return db.prepare(`
      SELECT t.*, c.label as category_label, c.color as category_color
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.status = 'done'
        AND DATE(t.completed_at) < ?
      ORDER BY t.completed_at DESC
      LIMIT 200
    `).all(today) as Task[]
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
    const title = validateNonEmpty(input.title, 'Title')
    validateMaxLength(title, 500, 'Title')
    if (input.notes) validateMaxLength(input.notes, 5000, 'Notes')

    const id = uuidv4()
    const now = localISOString()
    const maxPriority = (db.prepare('SELECT MAX(priority) as m FROM tasks').get() as { m: number | null }).m ?? -1
    db.prepare(`
      INSERT INTO tasks (id, title, status, priority, category_id, notes, created_at)
      VALUES (?, ?, 'todo', ?, ?, ?, ?)
    `).run(id, title, maxPriority + 1, input.category_id ?? null, input.notes ?? null, now)
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
    if (rest.title !== undefined) {
      rest.title = validateNonEmpty(rest.title, 'Title')
      validateMaxLength(rest.title, 500, 'Title')
    }
    if (rest.notes) validateMaxLength(rest.notes, 5000, 'Notes')

    const now = localISOString()
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

  // ── Search ─────────────────────────────────────────────────────────────────

  handle<{ query: string }>(IPC.TASKS_SEARCH, ({ query }) => {
    const trimmed = query.trim()
    if (!trimmed) return { tasks: [], journals: [] }
    const pattern = `%${trimmed}%`
    const tasks = db.prepare(`
      SELECT t.id, t.title, t.notes, t.status, t.created_at,
             c.label as category_label, c.color as category_color
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.title LIKE ? OR t.notes LIKE ?
      ORDER BY t.created_at DESC
      LIMIT 20
    `).all(pattern, pattern) as Array<{
      id: string; title: string; notes: string | null; status: string;
      created_at: string; category_label: string | null; category_color: string | null
    }>

    const journals = db.prepare(`
      SELECT id, date, intention, narrative
      FROM journal_entries
      WHERE intention LIKE ? OR narrative LIKE ?
      ORDER BY date DESC
      LIMIT 10
    `).all(pattern, pattern) as Array<{
      id: string; date: string; intention: string | null; narrative: string | null
    }>

    return {
      tasks: tasks.map(t => ({
        type: 'task' as const,
        id: t.id,
        title: t.title,
        subtitle: t.category_label ?? t.status,
        status: t.status,
        category_label: t.category_label,
        category_color: t.category_color,
      })),
      journals: journals.map(j => ({
        type: 'journal' as const,
        id: j.id,
        title: j.intention || `Journal: ${j.date}`,
        subtitle: j.date,
        date: j.date,
      }))
    }
  })

  // ── Bulk task operations ───────────────────────────────────────────────────

  handle<{ ids: string[]; status: Task['status'] }>(IPC.TASKS_BULK_UPDATE, ({ ids, status }) => {
    if (!ids.length) return { success: true }
    const now = localISOString()
    const update = db.prepare(
      status === 'done'
        ? 'UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?'
        : 'UPDATE tasks SET status = ? WHERE id = ?'
    )
    const bulkUpdate = db.transaction((taskIds: string[]) => {
      for (const id of taskIds) {
        if (status === 'done') {
          update.run(status, now, id)
        } else {
          update.run(status, id)
        }
      }
    })
    bulkUpdate(ids)
    return { success: true }
  })

  handle<{ ids: string[] }>(IPC.TASKS_BULK_DELETE, ({ ids }) => {
    if (!ids.length) return { success: true }
    const del = db.prepare('DELETE FROM tasks WHERE id = ?')
    const bulkDelete = db.transaction((taskIds: string[]) => {
      for (const id of taskIds) del.run(id)
    })
    bulkDelete(ids)
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

    const sessionStart = new Date(input.started_at)
    const date = localDateISO(sessionStart)
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

  handle<void>(IPC.SESSIONS_TODAY_STATS, () => {
    const today = localToday()
    const row = db.prepare(`
      SELECT COUNT(*) as session_count, COALESCE(SUM(duration_minutes), 0) as total_minutes
      FROM pomodoro_sessions
      WHERE DATE(started_at) = ?
    `).get(today) as { session_count: number; total_minutes: number }
    return row
  })

  handle<void>(IPC.SESSIONS_STREAK, () => {
    const rows = db.prepare(`
      SELECT DISTINCT DATE(started_at) as d
      FROM pomodoro_sessions
      ORDER BY d DESC
    `).all() as Array<{ d: string }>

    if (rows.length === 0) return 0

    const today = localToday()
    const yesterday = localYesterday()

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

  handle<void>(IPC.SESSIONS_STREAK_DETAIL, () => {
    const rows = db.prepare(`
      SELECT DISTINCT DATE(started_at) as d
      FROM pomodoro_sessions
      ORDER BY d DESC
    `).all() as Array<{ d: string }>

    const today = localToday()
    const yesterday = localYesterday()

    // Current streak
    let current = 0
    if (rows.length > 0 && (rows[0].d === today || rows[0].d === yesterday)) {
      current = 1
      for (let i = 1; i < rows.length; i++) {
        const prev = new Date(rows[i - 1].d + 'T00:00:00')
        const curr = new Date(rows[i].d + 'T00:00:00')
        if ((prev.getTime() - curr.getTime()) / 86400000 === 1) {
          current++
        } else {
          break
        }
      }
    }

    // Best streak (scan all dates)
    let best = 0
    let run = 1
    for (let i = 1; i < rows.length; i++) {
      const prev = new Date(rows[i - 1].d + 'T00:00:00')
      const curr = new Date(rows[i].d + 'T00:00:00')
      if ((prev.getTime() - curr.getTime()) / 86400000 === 1) {
        run++
      } else {
        if (run > best) best = run
        run = 1
      }
    }
    if (run > best) best = run
    if (rows.length === 0) best = 0

    return { current, best, allActiveDates: rows.map(r => r.d) }
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

  // ── Notes ───────────────────────────────────────────────────────────────────

  handle<void>(IPC.NOTES_GET_ALL, () => {
    return db.prepare('SELECT * FROM notes ORDER BY is_pinned DESC, updated_at DESC').all() as Note[]
  })

  handle<{ id: string }>(IPC.NOTES_GET_ONE, ({ id }) => {
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined
    if (!note) throw new Error('Note not found')
    return note
  })

  handle<CreateNoteInput>(IPC.NOTES_CREATE, (input) => {
    const id = uuidv4()
    const now = localISOString()
    db.prepare(`
      INSERT INTO notes (id, title, content, task_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, input.title ?? '', input.content ?? '', input.task_id ?? null, now, now)
    return db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note
  })

  handle<UpdateNoteInput>(IPC.NOTES_UPDATE, (input) => {
    const { id, ...rest } = input
    const now = localISOString()
    const setClauses: string[] = ['updated_at = ?']
    const values: unknown[] = [now]
    if (rest.title !== undefined)     { setClauses.push('title = ?');     values.push(rest.title) }
    if (rest.content !== undefined)   { setClauses.push('content = ?');   values.push(rest.content) }
    if (rest.task_id !== undefined)   { setClauses.push('task_id = ?');   values.push(rest.task_id) }
    if (rest.is_pinned !== undefined) { setClauses.push('is_pinned = ?'); values.push(rest.is_pinned) }
    db.prepare(`UPDATE notes SET ${setClauses.join(', ')} WHERE id = ?`).run(...values, id)
    return db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note
  })

  handle<{ id: string }>(IPC.NOTES_DELETE, ({ id }) => {
    db.prepare('DELETE FROM notes WHERE id = ?').run(id)
    return { success: true }
  })

  // ── Recurring Tasks ────────────────────────────────────────────────────────

  handle<void>(IPC.RECURRING_GET_ALL, () => {
    return db.prepare(`
      SELECT rt.*, c.label as category_label, c.color as category_color
      FROM recurring_tasks rt
      LEFT JOIN categories c ON rt.category_id = c.id
      ORDER BY rt.created_at ASC
    `).all() as RecurringTask[]
  })

  handle<CreateRecurringTaskInput>(IPC.RECURRING_CREATE, (input) => {
    const title = validateNonEmpty(input.title, 'Title')
    validateMaxLength(title, 500, 'Title')
    const id = uuidv4()
    const now = localISOString()
    db.prepare(`
      INSERT INTO recurring_tasks (id, title, category_id, notes, recurrence, active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(id, title, input.category_id ?? null, input.notes ?? null, input.recurrence, now)
    return db.prepare(`
      SELECT rt.*, c.label as category_label, c.color as category_color
      FROM recurring_tasks rt
      LEFT JOIN categories c ON rt.category_id = c.id
      WHERE rt.id = ?
    `).get(id) as RecurringTask
  })

  handle<UpdateRecurringTaskInput>(IPC.RECURRING_UPDATE, (input) => {
    const { id, ...rest } = input
    const setClauses: string[] = []
    const values: unknown[] = []
    if (rest.title !== undefined) {
      const t = validateNonEmpty(rest.title, 'Title')
      validateMaxLength(t, 500, 'Title')
      setClauses.push('title = ?'); values.push(t)
    }
    if (rest.category_id !== undefined) { setClauses.push('category_id = ?'); values.push(rest.category_id) }
    if (rest.notes !== undefined)       { setClauses.push('notes = ?');       values.push(rest.notes) }
    if (rest.recurrence !== undefined)  { setClauses.push('recurrence = ?');  values.push(rest.recurrence) }
    if (rest.active !== undefined)      { setClauses.push('active = ?');      values.push(rest.active) }
    if (setClauses.length > 0) {
      db.prepare(`UPDATE recurring_tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...values, id)
    }
    return db.prepare(`
      SELECT rt.*, c.label as category_label, c.color as category_color
      FROM recurring_tasks rt
      LEFT JOIN categories c ON rt.category_id = c.id
      WHERE rt.id = ?
    `).get(id) as RecurringTask
  })

  handle<{ id: string }>(IPC.RECURRING_DELETE, ({ id }) => {
    db.prepare('DELETE FROM recurring_tasks WHERE id = ?').run(id)
    return { success: true }
  })

  handle<void>(IPC.RECURRING_GENERATE, () => {
    const today = localToday()
    const dayOfWeek = new Date().getDay() // 0=Sun, 6=Sat
    const dayOfMonth = new Date().getDate()

    const recurring = db.prepare(`
      SELECT * FROM recurring_tasks WHERE active = 1
    `).all() as RecurringTask[]

    let created = 0
    for (const rt of recurring) {
      // Skip if already generated today
      if (rt.last_generated_date === today) continue

      // Check if this recurrence should fire today
      let shouldCreate = false
      switch (rt.recurrence) {
        case 'daily':
          shouldCreate = true
          break
        case 'weekdays':
          shouldCreate = dayOfWeek >= 1 && dayOfWeek <= 5
          break
        case 'weekly':
          // Generate on the same day of week the recurring task was created
          const createdDay = new Date(rt.created_at).getDay()
          shouldCreate = dayOfWeek === createdDay
          break
        case 'monthly':
          const createdDate = new Date(rt.created_at).getDate()
          shouldCreate = dayOfMonth === createdDate
          break
      }

      if (shouldCreate) {
        const taskId = uuidv4()
        const now = localISOString()
        const maxPriority = (db.prepare('SELECT MAX(priority) as m FROM tasks').get() as { m: number | null }).m ?? -1
        db.prepare(`
          INSERT INTO tasks (id, title, status, priority, category_id, notes, created_at)
          VALUES (?, ?, 'todo', ?, ?, ?, ?)
        `).run(taskId, rt.title, maxPriority + 1, rt.category_id ?? null, rt.notes ?? null, now)
        db.prepare('UPDATE recurring_tasks SET last_generated_date = ? WHERE id = ?').run(today, rt.id)
        created++
      }
    }
    return { created }
  })

  // ── Analytics ──────────────────────────────────────────────────────────────

  handle<{ days: number }>(IPC.ANALYTICS_WEEKLY, ({ days }) => {
    const results: Array<{ date: string; session_count: number; total_minutes: number; tasks_completed: number }> = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = localDateISO(d)
      const stats = db.prepare(`
        SELECT COUNT(*) as session_count, COALESCE(SUM(duration_minutes), 0) as total_minutes
        FROM pomodoro_sessions
        WHERE DATE(started_at) = ?
      `).get(dateStr) as { session_count: number; total_minutes: number }

      const completed = db.prepare(`
        SELECT COUNT(DISTINCT t.id) as count
        FROM tasks t
        WHERE DATE(t.completed_at) = ?
      `).get(dateStr) as { count: number }

      results.push({
        date: dateStr,
        session_count: stats.session_count,
        total_minutes: stats.total_minutes,
        tasks_completed: completed.count,
      })
    }
    return results
  })

  handle<{ days: number }>(IPC.ANALYTICS_CATEGORY_BREAKDOWN, ({ days }) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = localDateISO(cutoff)

    return db.prepare(`
      SELECT
        COALESCE(c.label, 'Uncategorized') as category_label,
        COALESCE(c.color, '#6366f1') as category_color,
        COUNT(ps.id) as session_count,
        COALESCE(SUM(ps.duration_minutes), 0) as total_minutes
      FROM pomodoro_sessions ps
      JOIN tasks t ON ps.task_id = t.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE DATE(ps.started_at) >= ?
      GROUP BY COALESCE(c.label, 'Uncategorized'), COALESCE(c.color, '#6366f1')
      ORDER BY total_minutes DESC
    `).all(cutoffStr) as Array<{
      category_label: string
      category_color: string
      session_count: number
      total_minutes: number
    }>
  })

  handle<{ days: number }>(IPC.ANALYTICS_DAILY_HISTORY, ({ days }) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = localDateISO(cutoff)

    return db.prepare(`
      SELECT
        DATE(ps.started_at) as date,
        COUNT(*) as session_count,
        SUM(ps.duration_minutes) as total_minutes
      FROM pomodoro_sessions ps
      WHERE DATE(ps.started_at) >= ?
      GROUP BY DATE(ps.started_at)
      ORDER BY date ASC
    `).all(cutoffStr) as Array<{
      date: string
      session_count: number
      total_minutes: number
    }>
  })

  // ── Backup / Export ────────────────────────────────────────────────────────

  handle<void>(IPC.DATA_EXPORT, () => {
    const categories = db.prepare('SELECT * FROM categories').all()
    const tasks = db.prepare('SELECT * FROM tasks').all()
    const sessions = db.prepare('SELECT * FROM pomodoro_sessions').all()
    const blocks = db.prepare('SELECT * FROM calendar_blocks').all()
    const journals = db.prepare('SELECT * FROM journal_entries').all()
    const notes = db.prepare('SELECT * FROM notes').all()
    const recurring = db.prepare('SELECT * FROM recurring_tasks').all()
    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
    const settings = settingsRows.reduce<Record<string, string>>((acc, { key, value }) => ({ ...acc, [key]: value }), {})

    return {
      version: 1,
      exported_at: localISOString(),
      categories,
      tasks,
      pomodoro_sessions: sessions,
      calendar_blocks: blocks,
      journal_entries: journals,
      notes,
      recurring_tasks: recurring,
      settings,
    }
  })

  handle<{ data: string }>(IPC.DATA_IMPORT, ({ data }) => {
    const backup = JSON.parse(data)
    if (!backup.version || !backup.categories || !backup.tasks) {
      throw new Error('Invalid backup file format')
    }

    const importTx = db.transaction(() => {
      // Clear existing data in reverse dependency order
      db.prepare('DELETE FROM calendar_blocks').run()
      db.prepare('DELETE FROM pomodoro_sessions').run()
      db.prepare('DELETE FROM notes').run()
      db.prepare('DELETE FROM journal_entries').run()
      db.prepare('DELETE FROM tasks').run()
      db.prepare('DELETE FROM recurring_tasks').run()
      db.prepare('DELETE FROM categories').run()
      db.prepare('DELETE FROM settings').run()

      // Re-insert
      for (const c of backup.categories) {
        db.prepare('INSERT INTO categories (id, label, color, is_predefined) VALUES (?, ?, ?, ?)').run(c.id, c.label, c.color, c.is_predefined)
      }
      for (const t of backup.tasks) {
        db.prepare('INSERT INTO tasks (id, title, status, priority, category_id, notes, created_at, completed_at, carry_over_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          t.id, t.title, t.status, t.priority, t.category_id, t.notes, t.created_at, t.completed_at, t.carry_over_date
        )
      }
      for (const s of backup.pomodoro_sessions) {
        db.prepare('INSERT INTO pomodoro_sessions (id, task_id, started_at, ended_at, duration_minutes, outcome, block_note) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          s.id, s.task_id, s.started_at, s.ended_at, s.duration_minutes, s.outcome, s.block_note
        )
      }
      for (const b of backup.calendar_blocks) {
        db.prepare('INSERT INTO calendar_blocks (id, session_id, task_id, start_time, end_time, date, color_tag) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          b.id, b.session_id, b.task_id, b.start_time, b.end_time, b.date, b.color_tag
        )
      }
      for (const j of backup.journal_entries) {
        db.prepare('INSERT INTO journal_entries (id, date, intention, narrative, mood, auto_summary) VALUES (?, ?, ?, ?, ?, ?)').run(
          j.id, j.date, j.intention, j.narrative, j.mood, j.auto_summary
        )
      }
      for (const n of backup.notes) {
        db.prepare('INSERT INTO notes (id, title, content, task_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
          n.id, n.title, n.content, n.task_id, n.created_at, n.updated_at
        )
      }
      if (backup.recurring_tasks) {
        for (const r of backup.recurring_tasks) {
          db.prepare('INSERT INTO recurring_tasks (id, title, category_id, notes, recurrence, active, last_generated_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
            r.id, r.title, r.category_id, r.notes, r.recurrence, r.active, r.last_generated_date, r.created_at
          )
        }
      }
      if (backup.settings) {
        for (const [key, value] of Object.entries(backup.settings)) {
          db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value as string)
        }
      }
    })

    importTx()
    return { success: true }
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
