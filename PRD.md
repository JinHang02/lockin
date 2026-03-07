# Product Requirements Document — LockIn

**Version:** 1.0
**Date:** March 2026
**Author:** Tang Jin Hang
**Status:** Draft

---

## 1. Overview

LockIn is a single-user desktop application (Electron) that unifies four productivity tools into one coherent daily workflow: task management, time-boxed focus sessions (Pomodoro), automatic calendar logging, and end-of-day journaling.

**Core philosophy:** Minimum input, maximum insight. The app learns your day from your work — not by asking you to log it. The calendar fills itself. The journal pre-populates with facts. You only add the narrative.

---

## 2. Goals & Non-Goals

### Goals
- Provide a unified daily loop: **Plan → Execute → Track → Reflect**
- Auto-generate calendar blocks from completed Pomodoro sessions (no manual input)
- Pre-populate journal entries with the day's data to reduce friction
- Store all data locally with SQLite — no internet dependency
- Ship a premium, polished desktop experience via Electron

### Non-Goals (v1)
- No AI features (deferred to v2)
- No cloud sync or multi-device support
- No collaboration or multi-user support
- No mobile or web version
- No external calendar integrations (Google Calendar, etc.)
- No week view calendar (deferred to v2)
- No past journal browser (deferred to v2)

---

## 3. User

**Single user:** Tang Jin Hang, Research Engineer.
Works on complex, cognitively demanding tasks. Wants to be intentional about how time is spent and have a clear end-of-day record without manually logging everything.

---

## 4. The Daily Loop

The app is structured around three phases:

**Morning**
Open Today's Board. Review carry-over tasks (inline banner prompt). Prioritize tasks for the day. Optionally write a one-line intention.

**During the Day**
Pick a task → start a Pomodoro. A persistent header bar shows the active timer and a progress bar. The rest of the UI dims and collapses during focus. On session end: mark outcome (Done / Still going / Blocked). Calendar block auto-logged silently.

**Evening**
Open the journal. Auto-summary pre-fills: tasks completed, total focus time, calendar blocks. User writes the narrative on top in a markdown editor.

---

## 5. Design System

### 5.1 Theme
- **Light mode and dark mode**, toggled via a switch in the sidebar or settings.
- **Aesthetic:** Neutral and minimal. Premium without being flashy. Think carefully balanced whitespace, refined typography, and subtle depth — the kind of UI that makes you pause when you first open it. Not cheap, not over-designed.
- **Color palette:**
  - Neutral base (near-white in light, near-black in dark) with very subtle warm or cool undertones
  - One strong accent color (single hue, used sparingly) for interactive elements and active states
  - Category colors: distinct but desaturated — readable, not loud
  - No gradients except where they add depth (e.g., progress bar fill)
- **Typography:** Clean sans-serif with intentional weight hierarchy. Body text is comfortable to read for long sessions.
- **Micro-interactions:** Subtle transitions on hover, focus, and state changes. Nothing jarring. The app should feel responsive and alive without being distracting.

### 5.2 Navigation — Sidebar
- **Persistent left sidebar** with icon + label navigation items:
  - Today's Board
  - Calendar
  - Journal
  - Settings
- Active item is clearly indicated (accent color or bold highlight)
- Sidebar is collapsible to icon-only mode for more focus space
- Sidebar does NOT grey out during a Pomodoro session (it remains navigable)

### 5.3 Pomodoro Header Bar
- A **persistent header bar** at the top of the main content area (not full-screen)
- Visible on all screens when a session is active
- Contains:
  - Active task name (truncated if needed)
  - Countdown timer (MM:SS)
  - Session progress bar (fills across the work duration)
  - Pause / Stop controls
- During focus mode, the content below the header bar **dims and collapses**: task list becomes faded and non-interactive; only the header bar is fully lit and actionable

### 5.4 Window
- **Resizable** window, no fixed dimensions
- Minimum window size enforced to prevent layout breakage (e.g., 900×600)
- Layout adapts gracefully to wider/narrower widths

---

## 6. Features

### 6.1 Todo List

- Create, edit, delete tasks with:
  - Title (required)
  - Notes (optional, markdown)
  - Category tag (Work / Personal / Learning / user-defined)
  - Priority (carried into ordering)
- Drag-and-drop to reorder the Today queue
- Task statuses: `todo` / `in-progress` / `done` / `blocked`
- **Carry-over:** At the start of a new day, an **inline banner** appears at the top of Today's Board listing incomplete tasks from the previous day. Each task has a Keep / Drop action. Banner is dismissible once all tasks are resolved.
- Tasks are always linked to a Pomodoro session — no floating sessions

#### Categories
- **Predefined:** Work, Personal, Learning
- **User-defined:** Users can add their own categories with a custom label and color (managed in Settings)
- Each category has an associated color used for calendar blocks

### 6.2 Pomodoro Timer

- Default: 25 min work / 5 min short break / 15 min long break (after 4 sessions)
- Timer durations are configurable in Settings
- Starting a session requires selecting a task from the Today queue
- **During focus:**
  - Persistent header bar shows task name, countdown, and progress bar
  - Content area below dims and becomes non-interactive (greyed out)
  - Sidebar remains accessible
- **On session end:**
  - In-app modal with outcome prompt: Done / Still going / Blocked
  - Sound notification plays (configurable in Settings)
  - If Blocked: optional one-liner field — "What's blocking you?" (saved to `block_note`)
- Timer runs via a **Web Worker** to prevent drift when window is minimized
- Timer drift target: < 1 second over a 25-minute session

### 6.3 Auto-Logged Calendar

- Every completed Pomodoro session auto-creates a calendar time block — zero manual input
- **Day view** showing all logged blocks for the selected date
- Blocks are **color-coded by task category**
- Calendar is **read-only** — a truth mirror, not a scheduler
- Hover on a block shows a tooltip: task name, duration, outcome
- Week view deferred to v2

### 6.4 Daily Journal

- One journal entry per day
- **Auto-populated summary** (read-only section):
  - Tasks completed (list)
  - Total focus time (minutes)
  - Number of Pomodoro sessions
  - Calendar blocks (time ranges + task names)
- **User narrative:** Full markdown editor — similar experience to Obsidian:
  - Live preview (WYSIWYG markdown rendering as you type)
  - Keyboard shortcuts for formatting (bold, italic, headings, lists, checkboxes)
  - Clean, distraction-free writing area
  - No sidebar panels or graph view (keep it simple for v1)
  - Implemented via **CodeMirror 6** with a markdown mode and custom theme matching the app's design system
- **Morning intention field:** Optional one-line text, written in the morning, displayed at the top of the journal entry
- **Mood rating:** Optional 1–5 scale (e.g., icon or slider)
- Past entries browsable by date — deferred to v2

---

## 7. Data Model

All data stored locally in **SQLite** via **Prisma ORM**.
Database file location: `app.getPath('userData')/lockin.db`
(e.g., `C:\Users\<user>\AppData\Roaming\LockIn\lockin.db` on Windows)

### Entities

**Task**
| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | Primary key |
| title | String | Required |
| status | Enum | todo / in-progress / done / blocked |
| priority | Int | Ordering within Today queue |
| category | String | FK to Category.id |
| notes | String? | Markdown text |
| created_at | DateTime | |
| completed_at | DateTime? | Set when status → done |
| carry_over_date | DateTime? | Date the task was carried forward to |

**Category**
| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | Primary key |
| label | String | e.g., "Work", "Personal" |
| color | String | Hex color code |
| is_predefined | Boolean | Predefined categories cannot be deleted |

**PomodoroSession**
| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | Primary key |
| task_id | String (FK) | Links to Task |
| started_at | DateTime | |
| ended_at | DateTime | |
| duration_minutes | Int | Actual completed duration |
| outcome | Enum | done / still-going / blocked |
| block_note | String? | Only set if outcome = blocked |

**CalendarBlock**
| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | Primary key |
| session_id | String (FK) | Links to PomodoroSession |
| task_id | String (FK) | Denormalized for quick calendar queries |
| start_time | DateTime | |
| end_time | DateTime | |
| date | String | YYYY-MM-DD, for day-view filtering |
| color_tag | String | Hex from category color at time of session |

**JournalEntry**
| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | Primary key |
| date | String | YYYY-MM-DD (unique) |
| intention | String? | Morning one-liner |
| narrative | String? | User-written markdown |
| mood | Int? | 1–5 |
| auto_summary | JSON | Computed: tasks_completed[], total_focus_minutes, session_count, blocks[] |

**Rules:**
- `CalendarBlock` is always derived from `PomodoroSession` — never created directly
- `JournalEntry.auto_summary` is recomputed on journal open from session data for that date

---

## 8. Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Desktop shell | Electron | Cross-platform desktop wrapper |
| UI framework | Vite + React + TypeScript | Fast for desktop, no SSR needed |
| Styling | Tailwind CSS + shadcn/ui | Fast iteration, consistent design primitives |
| Local database | SQLite via better-sqlite3 | Zero-config, single file, fast reads |
| ORM | Prisma | Type-safe queries, matches TypeScript frontend |
| State management | Zustand | Lightweight, good for timer + task state |
| Timer accuracy | Web Worker | Prevents drift when window is minimized |
| Markdown editor | CodeMirror 6 | Obsidian-style live-preview markdown editing |
| AI (v2) | Anthropic SDK | Deferred — summaries, pattern detection |

---

## 9. UX Principles

- **One primary action at a time** — planning, focusing, or reflecting; never all three at once
- **The calendar is earned, not built** — blocks come from real work, which makes the calendar motivating to look at
- **Minimum input, maximum insight** — the app learns your day; you don't log it
- **Friction-free journal** — the hard part (recalling what you did) is already done for you
- **Focus mode collapses, not hides** — the UI dims below the header so context is preserved but distraction is eliminated
- **Premium feel, no clutter** — every element earns its place; whitespace is intentional

---

## 10. Screen Inventory

| Screen | Description |
|---|---|
| Today's Board | Task list + active Pomodoro header. Primary daily view. Carry-over banner shown at top when applicable. |
| Calendar — Day View | All logged time blocks for a selected date, color-coded by category. Read-only. |
| Journal | Today's pre-populated summary + Obsidian-style markdown narrative editor. |
| Settings | Timer durations, sound preferences, category management (add/edit/delete), theme toggle, start-on-login. |

---

## 11. Settings

| Setting | Description |
|---|---|
| Theme | Light / Dark toggle |
| Timer — Work duration | Default 25 min, configurable |
| Timer — Short break | Default 5 min, configurable |
| Timer — Long break | Default 15 min, configurable |
| Sound | Enable/disable timer-end sound; volume control |
| Start on login | Toggle system startup behavior |
| Categories | Add, rename, recolor, or delete user-defined categories. Predefined categories (Work, Personal, Learning) can be recolored but not deleted. |

---

## 12. MVP Scope (v1)

### In Scope
- Full todo list with prioritization, drag-and-drop, and carry-over banner
- Pomodoro timer linked to tasks with outcome tracking and Web Worker accuracy
- Auto-generated calendar blocks from sessions
- Day view calendar (read-only)
- Daily journal with auto-populated summary and Obsidian-style markdown editor
- SQLite local storage via Prisma
- Sidebar navigation with collapse
- Light/dark theme toggle
- Settings: timer durations, sound, start-on-login, category management

### Deferred to v2
- AI-generated summaries and pattern detection (Anthropic SDK)
- Week view calendar
- Past journal browser
- Cloud sync
- Category analytics / focus time graphs
- Recurring tasks

---

## 13. Success Metrics

Since this is a personal tool, success is measured by personal adoption and utility:

- Daily active use for 30 consecutive days
- Calendar accurately reflects actual work time with zero manual input
- Journal entries feel useful for reflection, not a chore
- Timer drift < 1 second over a 25-minute session
- Opening the app feels good — the UI quality is immediately apparent

---

*LockIn · PRD v1.0 · March 2026 · Internal*
