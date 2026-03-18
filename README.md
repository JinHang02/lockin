# LockIn

**Lock in to your day.** A beautifully crafted desktop app that brings together task management, Pomodoro focus sessions, automatic calendar logging, journaling, and analytics — all in one place.

![Electron](https://img.shields.io/badge/Electron-29-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Why LockIn?

Most productivity tools make you choose: a to-do app here, a timer there, a journal somewhere else. LockIn brings it all together in a single, offline-first desktop app. No accounts. No cloud. No subscriptions. Just you and your work.

**Your daily loop: Plan > Execute > Track > Reflect**

The calendar fills itself from your focus sessions. The journal pre-populates with your day's data. You just add the narrative.

## What You Get

**Task Board** — Drag-and-drop tasks with categories, priorities, subtasks, and smart carry-over for anything you didn't finish yesterday. Save templates for tasks you create often.

**Pomodoro Timer** — Start a focus session, pick a task, and lock in. The timer runs in the background without drifting, even when minimized. Tracks every session with outcomes.

**Auto-Calendar** — Your calendar builds itself. Every completed focus session becomes a time block — no manual logging required.

**Journal** — A rich markdown editor for daily reflections. Auto-generates a summary of what you worked on, how long, and what you accomplished. Add mood tracking and your own thoughts.

**Notes** — A full two-panel notes editor with markdown support. Pin important notes, archive old ones, and link notes to specific tasks.

**Analytics** — See where your time actually goes. Session history, category breakdowns, top tasks, hourly heatmaps, and streak tracking to keep you motivated.

**And more** — Global search (Ctrl+K), recurring tasks on any schedule, three-level focus mode, dark/light themes, full data export & import.

## Download

Head to the [Releases](../../releases) page and grab the latest installer for your platform:

- **Windows** — `.exe` installer
- **macOS** — `.dmg` (Intel + Apple Silicon)
- **Linux** — `.AppImage`

## Build From Source

### Prerequisites

- Node.js (v18+)
- npm

### Setup

```bash
npm install
```

If native module rebuild fails:

```bash
npx electron-rebuild -f -w better-sqlite3
```

### Run in Development

```bash
npm run dev
```

### Build Installers

```bash
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux
```

> Installers must be built on the target OS. The included GitHub Actions workflow handles cross-platform builds automatically when you push a version tag.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 29 |
| Build | electron-vite, Vite 5 |
| Frontend | React 19, TypeScript, Tailwind CSS |
| UI | Radix UI, lucide-react, @dnd-kit |
| Editor | CodeMirror 6 |
| State | Zustand |
| Database | SQLite (local, offline, no cloud) |

## License

MIT
