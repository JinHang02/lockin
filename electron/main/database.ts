import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

let db: Database.Database

export function getDb(): Database.Database {
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'lockin.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations()
  seedDefaultData()
}

function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      color      TEXT NOT NULL,
      is_predefined INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'todo'
                        CHECK(status IN ('todo','in-progress','done','blocked')),
      priority        INTEGER NOT NULL DEFAULT 0,
      category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
      notes           TEXT,
      created_at      TEXT NOT NULL,
      completed_at    TEXT,
      carry_over_date TEXT
    );

    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id               TEXT PRIMARY KEY,
      task_id          TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      started_at       TEXT NOT NULL,
      ended_at         TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      outcome          TEXT NOT NULL
                         CHECK(outcome IN ('done','still-going','blocked')),
      block_note       TEXT
    );

    CREATE TABLE IF NOT EXISTS calendar_blocks (
      id         TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES pomodoro_sessions(id) ON DELETE CASCADE,
      task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      start_time TEXT NOT NULL,
      end_time   TEXT NOT NULL,
      date       TEXT NOT NULL,
      color_tag  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id           TEXT PRIMARY KEY,
      date         TEXT NOT NULL UNIQUE,
      intention    TEXT,
      narrative    TEXT,
      mood         INTEGER CHECK(mood >= 1 AND mood <= 5),
      auto_summary TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at  ON tasks(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_task_id  ON pomodoro_sessions(task_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_date     ON calendar_blocks(date);
    CREATE INDEX IF NOT EXISTS idx_journal_date      ON journal_entries(date);
  `)
}

function seedDefaultData(): void {
  const existing = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }
  if (existing.count > 0) return

  const predefined = [
    { id: uuidv4(), label: 'Work',     color: '#818cf8', is_predefined: 1 },
    { id: uuidv4(), label: 'Personal', color: '#34d399', is_predefined: 1 },
    { id: uuidv4(), label: 'Learning', color: '#f59e0b', is_predefined: 1 }
  ]
  const insert = db.prepare(
    'INSERT INTO categories (id, label, color, is_predefined) VALUES (?, ?, ?, ?)'
  )
  for (const c of predefined) {
    insert.run(c.id, c.label, c.color, c.is_predefined)
  }

  const defaultSettings: Record<string, string> = {
    theme:                    'dark',
    timer_work_minutes:       '25',
    timer_short_break_minutes:'5',
    timer_long_break_minutes: '15',
    sound_enabled:            'true',
    sound_volume:             '80',
    sound_type:               'chime',
    start_on_login:           'false'
  }
  const setSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  )
  for (const [key, value] of Object.entries(defaultSettings)) {
    setSetting.run(key, value)
  }
}
