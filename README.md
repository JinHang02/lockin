# LockIn

Lock in to your day. A desktop productivity app that unifies task management, Pomodoro focus sessions, automatic calendar logging, and daily journaling into one cohesive workflow.

![Electron](https://img.shields.io/badge/Electron-29-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-local-003B57?logo=sqlite&logoColor=white)

## Philosophy

**Minimum input, maximum insight.** The app learns your day from your work — not by asking you to log it. The calendar fills itself. The journal pre-populates with facts. You only add the narrative.

**Daily loop: Plan > Execute > Track > Reflect**

## Features

- **Today's Board** — Drag-and-drop task management with categories, priorities, and carry-over prompts for incomplete tasks
- **Pomodoro Timer** — Focus/break sessions with a drift-safe Web Worker timer, configurable durations, and session outcome tracking
- **Auto-Calendar** — Calendar blocks generated automatically from completed Pomodoro sessions (no manual logging)
- **Journal** — Daily entries with a CodeMirror 6 markdown editor, mood tracking, and auto-summaries from the day's data

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 29 |
| Build | electron-vite, Vite 5 |
| Frontend | React 19, TypeScript |
| Styling | Tailwind CSS |
| UI | Radix UI primitives, lucide-react |
| Editor | CodeMirror 6 |
| Drag & Drop | @dnd-kit |
| State | Zustand |
| Database | better-sqlite3 (local, no cloud) |

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Install

```bash
npm install
```

If native module rebuild fails automatically:

```bash
npx electron-rebuild -f -w better-sqlite3
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Package

```bash
npm run package
```

## Project Structure

```
electron/
  main/           # Main process (database, IPC, window management)
  preload/        # Context bridge API
src/
  assets/         # Logo SVGs
  components/
    board/        # Task board (Today's Board)
    calendar/     # Auto-calendar view
    journal/      # Journal editor + mood tracking
    layout/       # Sidebar, Pomodoro header
    pomodoro/     # Outcome modal
    settings/     # Settings view
    ui/           # Shared UI primitives (Button, Dialog, Toast, etc.)
  store/          # Zustand stores (app, task, pomodoro, toast)
  workers/        # Web Worker for timer
resources/        # Generated PNG icons for Electron
```

## License

MIT
