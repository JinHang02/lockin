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

// ── Version-based migration system ──────────────────────────────────────────

const MIGRATIONS: Array<(db: Database.Database) => void> = [
  // v1: initial schema
  (db) => {
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

      CREATE TABLE IF NOT EXISTS notes (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL DEFAULT '',
        content    TEXT NOT NULL DEFAULT '',
        task_id    TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
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
      CREATE INDEX IF NOT EXISTS idx_notes_updated_at  ON notes(updated_at);
      CREATE INDEX IF NOT EXISTS idx_notes_task_id     ON notes(task_id);
    `)
  },

  // v2: recurring tasks + search indexes
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS recurring_tasks (
        id                  TEXT PRIMARY KEY,
        title               TEXT NOT NULL,
        category_id         TEXT REFERENCES categories(id) ON DELETE SET NULL,
        notes               TEXT,
        recurrence          TEXT NOT NULL CHECK(recurrence IN ('daily','weekdays','weekly','monthly')),
        active              INTEGER NOT NULL DEFAULT 1,
        last_generated_date TEXT,
        created_at          TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON pomodoro_sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);
    `)
  },

  // v3: note pinning
  (db) => {
    db.exec(`ALTER TABLE notes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`)
  },

  // v4: subtasks + task due dates
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id         TEXT PRIMARY KEY,
        task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        is_done    INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);

      ALTER TABLE tasks ADD COLUMN due_date TEXT;
    `)
  },

  // v5: session goals per task
  (db) => {
    db.exec(`ALTER TABLE tasks ADD COLUMN session_goal INTEGER`)
  },

  // v6: note archiving, task templates, streak grace days
  (db) => {
    db.exec(`
      ALTER TABLE notes ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS task_templates (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        title       TEXT NOT NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        notes       TEXT,
        session_goal INTEGER,
        subtasks    TEXT,
        created_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(is_archived);
    `)
  },
]

function runMigrations(): void {
  // Ensure schema_version table exists
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL DEFAULT 0)')

  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined
  let currentVersion = row?.version ?? 0

  if (!row) {
    db.prepare('INSERT INTO schema_version (version) VALUES (0)').run()
  }

  // Run pending migrations
  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    MIGRATIONS[i](db)
  }

  // Update stored version
  if (MIGRATIONS.length > currentVersion) {
    db.prepare('UPDATE schema_version SET version = ?').run(MIGRATIONS.length)
  }
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
